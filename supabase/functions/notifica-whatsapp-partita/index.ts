import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Match = {
  id: number;
  data: string;
  avversario: string;
  tipo: string | null;
  orario: string | null;
  campo: string | null;
  scadenza_disponibilita: string | null;
};

type Person = {
  id: number;
  nome: string;
};

type Contact = {
  giocatore_id: number;
  telefono: string | null;
  whatsapp_attivo: boolean | null;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`CONFIG:${name}`);
  return value;
}

function normalizePhone(phone: string | null | undefined) {
  const raw = (phone || "").trim();
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  return digits;
}

function publicMatchUrl(matchId: number) {
  const siteUrl = (Deno.env.get("SITE_PUBLIC_URL") || "https://project-zxasn.vercel.app").replace(/\/+$/, "");
  return `${siteUrl}/?match=${matchId}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatDeadline(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildPlainMessage(match: Match) {
  const lieu = match.campo ? `\nLieu: ${match.campo}` : "";
  const limite = match.scadenza_disponibilita
    ? `\nRepondre avant: ${formatDeadline(match.scadenza_disponibilita)}`
    : "";

  return `Nouveau match A.S. Bologne

Adversaire: ${match.avversario}
Date: ${formatDate(match.data)}
Heure: ${match.orario || "-"}
${match.tipo === "Casa" ? "A domicile" : "A l'exterieur"}${lieu}${limite}

Clique ici pour repondre:
${publicMatchUrl(match.id)}`;
}

function buildWhatsAppPayload(match: Match, person: Person, to: string) {
  const mode = (Deno.env.get("WHATSAPP_MESSAGE_MODE") || "template").toLowerCase();

  if (mode === "text") {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: true,
        body: buildPlainMessage(match)
      }
    };
  }

  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "as_bologne_match_invite";
  const languageCode = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "fr";
  const parameters = [
    person.nome,
    match.avversario,
    formatDate(match.data),
    match.orario || "-",
    match.campo || "-",
    formatDeadline(match.scadenza_disponibilita),
    publicMatchUrl(match.id)
  ].map(text => ({ type: "text", text: String(text).slice(0, 1024) }));

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters
        }
      ]
    }
  };
}

async function logNotification(
  supabaseAdmin: ReturnType<typeof createClient>,
  row: Record<string, unknown>
) {
  const { error } = await supabaseAdmin.from("notifiche_whatsapp").insert(row);
  if (error) console.warn("Log notifiche_whatsapp non salvato:", error.message);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "METODO_NON_VALIDO" });
  }

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const whatsappToken = env("WHATSAPP_ACCESS_TOKEN");
    const whatsappPhoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
    const graphVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v23.0";

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      return jsonResponse(401, { error: "LOGIN_RICHIESTO" });
    }

    const body = await req.json().catch(() => ({}));
    const matchId = Number(body.match_id);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return jsonResponse(400, { error: "PARTITA_NON_VALIDA" });
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false }
    });

    const { data: isAdmin, error: adminCheckError } = await supabaseUser.rpc("is_admin");
    if (adminCheckError || !isAdmin) {
      return jsonResponse(403, { error: "ADMIN_NON_AUTORIZZATO" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id,data,avversario,tipo,orario,campo,scadenza_disponibilita")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return jsonResponse(404, { error: "PARTITA_NON_TROVATA" });
    }

    const { data: people, error: peopleError } = await supabaseAdmin
      .from("giocatori")
      .select("id,nome")
      .eq("attivo", true)
      .order("tipo")
      .order("nome");

    if (peopleError) {
      return jsonResponse(500, { error: "LETTURA_PERSONE_FALLITA", message: peopleError.message });
    }

    const ids = (people || []).map((person: Person) => person.id);
    let contacts: Contact[] = [];

    if (ids.length) {
      const { data, error } = await supabaseAdmin
        .from("contatti_giocatori")
        .select("giocatore_id,telefono,whatsapp_attivo")
        .in("giocatore_id", ids);

      if (error) {
        return jsonResponse(500, { error: "LETTURA_CONTATTI_FALLITA", message: error.message });
      }

      contacts = data || [];
    }

    const contactMap = new Map<number, Contact>();
    contacts.forEach(contact => contactMap.set(contact.giocatore_id, contact));

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const details: Record<string, unknown>[] = [];

    for (const person of (people || []) as Person[]) {
      const contact = contactMap.get(person.id);
      const phone = normalizePhone(contact?.telefono);

      if (!phone || contact?.whatsapp_attivo === false) {
        skipped += 1;
        const detail = !phone ? "TELEFONO_MANCANTE" : "WHATSAPP_DISATTIVATO";
        details.push({ id: person.id, nome: person.nome, stato: "saltato", detail });
        await logNotification(supabaseAdmin, {
          match_id: matchId,
          giocatore_id: person.id,
          telefono: contact?.telefono || null,
          stato: "saltato",
          dettaglio: detail
        });
        continue;
      }

      const response = await fetch(
        `https://graph.facebook.com/${graphVersion}/${whatsappPhoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(buildWhatsAppPayload(match as Match, person, phone))
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        failed += 1;
        const message = result?.error?.message || `HTTP ${response.status}`;
        details.push({ id: person.id, nome: person.nome, stato: "errore", detail: message });
        await logNotification(supabaseAdmin, {
          match_id: matchId,
          giocatore_id: person.id,
          telefono: contact?.telefono || null,
          stato: "errore",
          dettaglio: message
        });
        continue;
      }

      sent += 1;
      details.push({ id: person.id, nome: person.nome, stato: "inviato" });
      await logNotification(supabaseAdmin, {
        match_id: matchId,
        giocatore_id: person.id,
        telefono: contact?.telefono || null,
        stato: "inviato",
        dettaglio: result?.messages?.[0]?.id || "OK"
      });
    }

    return jsonResponse(200, {
      ok: failed === 0,
      mode: (Deno.env.get("WHATSAPP_MESSAGE_MODE") || "template").toLowerCase(),
      sent,
      skipped,
      failed,
      total: (people || []).length,
      details
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("CONFIG:")) {
      return jsonResponse(500, {
        error: "CONFIGURATION_WHATSAPP_MANQUANTE",
        message: `Secret manquant: ${message.replace("CONFIG:", "")}`
      });
    }

    console.error(error);
    return jsonResponse(500, { error: "ERREUR_INTERNE", message });
  }
});
