import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";
const ADMIN_LOGIN_EMAIL = "j.ntiegoun@gmail.com";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let whatsappPlayers = [];

document.addEventListener("DOMContentLoaded", async () => {
  applyStoredLogo();
  const { data } = await supabase.auth.getSession();
  if (data.session) await showPanel();
});

// Carica il logo salvato e lo applica alla topbar / login
async function applyStoredLogo() {
  try {
    const { data } = await supabase.from("impostazioni").select("valore").eq("chiave", "logo_url").single();
    if (data && data.valore) {
      document.querySelectorAll('.topbar-crest img, .admin-icon img').forEach(img => { img.src = data.valore; });
    }
  } catch (e) { /* tabella impostazioni non ancora creata, ignora */ }
}

// ---- AUTH SUPABASE ----
window.adminLogin = async function () {
  const pw = document.getElementById("admin-pw").value;
  const errEl = document.getElementById("login-err");

  if (!pw) {
    errEl.textContent = "Écris le mot de passe.";
    showMsg('login-err');
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: ADMIN_LOGIN_EMAIL,
    password: pw
  });
  if (error) {
    errEl.textContent = "Mot de passe incorrect.";
    showMsg('login-err');
    return;
  }

  await showPanel();
};

window.adminLogout = async function () {
  await supabase.auth.signOut();
  document.getElementById("admin-area").classList.add("section-hidden");
  document.getElementById("login-area").classList.remove("section-hidden");
  document.getElementById("admin-pw").value = '';
};

async function showPanel() {
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) {
    await supabase.auth.signOut();
    const errEl = document.getElementById("login-err");
    errEl.textContent = "Configuration admin incomplète. Exécute la migration SQL.";
    showMsg('login-err');
    return;
  }

  if (!isAdmin) {
    await supabase.auth.signOut();
    const errEl = document.getElementById("login-err");
    errEl.textContent = "Ce compte n'est pas autorisé.";
    showMsg('login-err');
    return;
  }

  document.getElementById("login-area").classList.add("section-hidden");
  document.getElementById("admin-area").classList.remove("section-hidden");
  await loadAllData();
}

// ---- LOAD ALL ----
async function loadAllData() {
  const [{ count: mc }, { count: dc }, { count: gc }] = await Promise.all([
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("disponibilita").select("*", { count: "exact", head: true }),
    supabase.from("giocatori").select("*", { count: "exact", head: true }).eq("tipo", "giocatore").eq("attivo", true),
  ]);
  document.getElementById("adm-matches").textContent = mc || 0;
  document.getElementById("adm-risposte").textContent = dc || 0;
  document.getElementById("adm-giocatori").textContent = gc || 0;
  await loadAdminMatches();
  await loadPlayerList();
  await loadFotoAdmin();
}

// ---- TAB ADMIN ----
window.switchAdminTab = function (name, btn) {
  ['matches', 'presenze', 'giocatori', 'foto', 'reglages'].forEach(t => {
    document.getElementById('adm-tab-' + t)?.classList.toggle('section-hidden', t !== name);
  });
  document.querySelectorAll('.tab-sub-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (name === 'presenze') loadMatchSelectPresenze();
  if (name === 'foto') loadFotoMatchSelect();
  if (name === 'reglages') loadCurrentLogo();
};

// ---- LOGO / IMPOSTAZIONI ----
async function loadCurrentLogo() {
  const { data } = await supabase.from("impostazioni").select("valore").eq("chiave", "logo_url").single();
  if (data && data.valore) {
    const img = document.getElementById("logo-current");
    if (img) { img.src = data.valore; img.style.display = 'block'; }
  }
}

window.uploadLogo = async function () {
  const file = document.getElementById("logo-input").files[0];
  if (!file) { document.getElementById("logo-err").textContent = "Sélectionne un fichier"; showMsg('logo-err'); return; }
  try {
    const ext = file.name.split('.').pop();
    const path = `logo/logo_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('foto').upload(path, file, { upsert: true });
    if (upErr) { document.getElementById("logo-err").textContent = "Erreur: " + upErr.message; showMsg('logo-err'); return; }
    const url = supabase.storage.from('foto').getPublicUrl(path).data.publicUrl;
    // Salva nelle impostazioni (upsert)
    const { error } = await supabase.from("impostazioni").upsert({ chiave: "logo_url", valore: url }, { onConflict: "chiave" });
    if (error) { document.getElementById("logo-err").textContent = "Erreur: " + error.message; showMsg('logo-err'); return; }
    document.getElementById("logo-current").src = url;
    document.getElementById("logo-input").value = '';
    showMsg('logo-success');
  } catch (e) {
    document.getElementById("logo-err").textContent = "Erreur: " + e.message;
    showMsg('logo-err');
  }
};

// ---- MATCHES ----
function toDateTimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deadlineToIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function isDeadlineBeforeMatch(matchDate, matchTime, deadline) {
  if (!matchDate || !deadline) return false;
  const matchMoment = new Date(`${matchDate}T${matchTime || '23:59'}:00`);
  return new Date(deadline).getTime() < matchMoment.getTime();
}

function fmtDeadline(value) {
  if (!value) return "Aucune limite";
  return new Date(value).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

window.setDefaultDeadline = function () {
  const matchDate = document.getElementById("new-data").value;
  const deadlineInput = document.getElementById("new-scadenza");
  if (!matchDate || deadlineInput.value) return;
  const d = new Date(matchDate + 'T18:00:00');
  d.setDate(d.getDate() - 1);
  deadlineInput.value = toDateTimeLocal(d);
};

async function loadAdminMatches() {
  const { data } = await supabase.from("matches").select("*").order("data", { ascending: false });
  const el = document.getElementById("admin-match-list");
  const sel = document.getElementById("res-match");
  if (!data || !data.length) {
    el.innerHTML = '<div class="empty-msg">Nessuna partita ancora.</div>';
    if (sel) sel.innerHTML = '<option value="">-- Nessuna --</option>';
    return;
  }
  el.innerHTML = data.map(m => {
    const r = getResult(m);
    const bCls = r === 'V' ? 'badge-win' : r === 'N' ? 'badge-draw' : r === 'D' ? 'badge-loss' : 'badge-up';
    const dt = new Date(m.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const safeAvv = m.avversario.replace(/'/g, "\\'");
    return `<div class="match-admin-row" id="match-row-${m.id}">
      <div style="flex:1;font-size:13px;">
        ${dt} — <strong>${m.avversario}</strong> (${m.tipo === 'Casa' ? 'Dom.' : 'Ext.'})
        <div class="admin-deadline"><i class="ti ti-clock"></i> Réponses: ${fmtDeadline(m.scadenza_disponibilita)}</div>
      </div>
      <span class="badge ${bCls}">${m.risultato || 'À venir'}</span>
      <button class="icon-btn icon-btn-wa" onclick="showWhatsAppPanel(${m.id})" title="Prévenir sur WhatsApp"><i class="ti ti-brand-whatsapp"></i></button>
      <button class="icon-btn" onclick="editMatch(${m.id})" title="Modifier"><i class="ti ti-pencil"></i></button>
      <button class="icon-btn icon-btn-del" onclick="deleteMatch(${m.id},'${safeAvv}')" title="Supprimer"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');
  if (sel) sel.innerHTML = data.map(m => {
    const dt = new Date(m.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `<option value="${m.id}">${dt} — ${m.avversario}</option>`;
  }).join('');
}

function getResult(m) {
  if (!m.risultato) return null;
  const p = m.risultato.split('-').map(Number);
  if (m.tipo === 'Casa') return p[0] > p[1] ? 'V' : p[0] === p[1] ? 'N' : 'D';
  return p[1] > p[0] ? 'V' : p[0] === p[1] ? 'N' : 'D';
}

// Modifica inline di una partita (data, avversario, tipo, orario, campo, risultato)
window.editMatch = async function (id) {
  const { data: m } = await supabase.from("matches").select("*").eq("id", id).single();
  if (!m) return;
  const row = document.getElementById(`match-row-${id}`);
  if (!row) return;
  row.innerHTML = `<div style="width:100%">
    <div class="form-grid">
      <div class="form-row"><label class="form-lbl">Date</label><input type="date" id="em-data-${id}" value="${m.data}"></div>
      <div class="form-row"><label class="form-lbl">Adversaire</label><input type="text" id="em-avv-${id}" value="${m.avversario.replace(/"/g, '&quot;')}"></div>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label class="form-lbl">Dom. / Ext.</label>
        <select id="em-ht-${id}">
          <option value="Casa" ${m.tipo === 'Casa' ? 'selected' : ''}>Domicile</option>
          <option value="Trasferta" ${m.tipo === 'Trasferta' ? 'selected' : ''}>Extérieur</option>
        </select>
      </div>
      <div class="form-row"><label class="form-lbl">Heure</label><input type="time" id="em-ora-${id}" value="${m.orario || '15:30'}"></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label class="form-lbl">Terrain</label><input type="text" id="em-campo-${id}" value="${(m.campo || '').replace(/"/g, '&quot;')}"></div>
      <div class="form-row"><label class="form-lbl">Score (ex. 2-1, vide si à venir)</label><input type="text" id="em-score-${id}" value="${m.risultato || ''}" placeholder="2-1"></div>
    </div>
    <div class="form-row deadline-admin-field">
      <label class="form-lbl">Fin des réponses</label>
      <input type="datetime-local" id="em-scadenza-${id}" value="${toDateTimeLocal(m.scadenza_disponibilita)}">
      <div class="simple-help">Après cette heure, les réponses sont bloquées.</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn-primary" style="flex:1" onclick="saveMatchEdit(${id})"><i class="ti ti-device-floppy"></i> Enregistrer</button>
      <button class="btn-outline" onclick="loadAdminMatches()"><i class="ti ti-x"></i> Annuler</button>
    </div>
  </div>`;
};

// Salva le modifiche di una partita
window.saveMatchEdit = async function (id) {
  const data = document.getElementById(`em-data-${id}`).value;
  const avv = document.getElementById(`em-avv-${id}`).value.trim();
  const score = document.getElementById(`em-score-${id}`).value.trim();
  const scadenza = document.getElementById(`em-scadenza-${id}`).value;
  if (!data || !avv || (!score && !scadenza)) {
    alert("Date, adversaire et fin des réponses requis");
    return;
  }
  const matchTime = document.getElementById(`em-ora-${id}`).value;
  if (scadenza && !isDeadlineBeforeMatch(data, matchTime, scadenza)) {
    alert("La fin des réponses doit être avant le match.");
    return;
  }
  const { error } = await supabase.from("matches").update({
    data, avversario: avv,
    tipo: document.getElementById(`em-ht-${id}`).value,
    orario: matchTime,
    campo: document.getElementById(`em-campo-${id}`).value.trim(),
    scadenza_disponibilita: deadlineToIso(scadenza),
    risultato: score,
    stato: score ? 'passata' : 'futura'
  }).eq("id", id);
  if (error) { alert("Erreur: " + error.message); return; }
  await loadAdminMatches();
};

// Elimina una partita (e le sue presenze/foto associate via CASCADE)
window.deleteMatch = async function (id, avv) {
  if (!confirm(`Supprimer le match contre ${avv} ?\n(Les présences et photos liées seront aussi supprimées)`)) return;
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) { alert("Erreur: " + error.message); return; }
  await loadAdminMatches();
  const { count } = await supabase.from("matches").select("*", { count: "exact", head: true });
  document.getElementById("adm-matches").textContent = count || 0;
};

window.addMatch = async function () {
  const data = document.getElementById("new-data").value;
  const avv = document.getElementById("new-avv").value.trim();
  const scadenza = document.getElementById("new-scadenza").value;
  if (!data || !avv || !scadenza) { showMsg('match-err'); return; }
  const matchTime = document.getElementById("new-ora").value;
  if (!isDeadlineBeforeMatch(data, matchTime, scadenza)) {
    document.getElementById("match-err").textContent = "La fin des réponses doit être avant le match.";
    showMsg('match-err');
    return;
  }
  const { data: created, error } = await supabase.from("matches").insert({
    data, avversario: avv,
    tipo: document.getElementById("new-ht").value,
    orario: matchTime,
    campo: document.getElementById("new-campo").value.trim(),
    scadenza_disponibilita: deadlineToIso(scadenza),
    risultato: '', stato: 'futura'
  }).select("*").single();
  if (error) {
    console.error(error);
    document.getElementById("match-err").textContent = "Erreur: " + error.message;
    showMsg('match-err');
    return;
  }
  document.getElementById("new-data").value = '';
  document.getElementById("new-avv").value = '';
  document.getElementById("new-campo").value = '';
  document.getElementById("new-scadenza").value = '';
  showMsg('match-success');
  await loadAdminMatches();
  const { count } = await supabase.from("matches").select("*", { count: "exact", head: true });
  document.getElementById("adm-matches").textContent = count || 0;
  await showWhatsAppPanel(created.id);
};

function buildWhatsAppMessage(match) {
  const date = new Date(match.data + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const lieu = match.campo ? `\nLieu: ${match.campo}` : '';
  const limite = match.scadenza_disponibilita
    ? `\nRépondre avant: ${fmtDeadline(match.scadenza_disponibilita)}`
    : '';
  const link = `https://project-zxasn.vercel.app/?match=${match.id}`;

  return `Nouveau match A.S. Bologne

Adversaire: ${match.avversario}
Date: ${date}
Heure: ${match.orario || '-'}
${match.tipo === 'Casa' ? 'À domicile' : 'À l’extérieur'}${lieu}${limite}

Clique ici pour répondre:
${link}`;
}

function normalizeWhatsAppPhone(phone) {
  const raw = (phone || '').trim();
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);
  return digits;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

window.showWhatsAppPanel = async function (matchId) {
  const [{ data: match, error: matchError }, { data: players, error: playerError }] = await Promise.all([
    supabase.from("matches").select("*").eq("id", matchId).single(),
    supabase.from("giocatori").select("id,nome,tipo,ruolo").eq("attivo", true).order("tipo").order("nome")
  ]);

  if (matchError || playerError || !match) {
    alert("Impossible de préparer le message WhatsApp.");
    return;
  }

  const ids = (players || []).map(p => p.id);
  let contacts = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from("contatti_giocatori")
      .select("giocatore_id,telefono,whatsapp_attivo")
      .in("giocatore_id", ids);
    if (error) {
      alert("Impossible de lire les téléphones: " + error.message);
      return;
    }
    contacts = data || [];
  }

  const contactMap = Object.fromEntries(contacts.map(c => [c.giocatore_id, c]));
  whatsappPlayers = (players || []).map(p => ({ ...p, contact: contactMap[p.id] || null }));
  document.getElementById("whatsapp-message").value = buildWhatsAppMessage(match);
  document.getElementById("whatsapp-panel").classList.remove("section-hidden");
  refreshWhatsAppLinks();
  document.getElementById("whatsapp-panel").scrollIntoView({ behavior: "smooth", block: "start" });
};

window.refreshWhatsAppLinks = function () {
  const list = document.getElementById("whatsapp-player-list");
  const message = document.getElementById("whatsapp-message").value;
  list.innerHTML = '';

  whatsappPlayers.forEach(player => {
    const row = document.createElement("div");
    row.className = "whatsapp-player-row";

    const name = document.createElement("div");
    name.className = "whatsapp-player-name";
    name.textContent = player.nome;
    row.appendChild(name);

    const phone = normalizeWhatsAppPhone(player.contact?.telefono);
    if (!phone || player.contact?.whatsapp_attivo === false) {
      const missing = document.createElement("span");
      missing.className = "badge badge-loss";
      missing.textContent = phone ? "WhatsApp désactivé" : "Téléphone manquant";
      row.appendChild(missing);
    } else {
      const link = document.createElement("a");
      link.className = "btn-whatsapp-small";
      link.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = '<i class="ti ti-brand-whatsapp"></i> Envoyer';
      row.appendChild(link);
    }

    list.appendChild(row);
  });

  if (!whatsappPlayers.length) {
    list.innerHTML = '<div class="empty-msg">Aucune personne active.</div>';
  }
};

window.shareWhatsAppMessage = function () {
  const message = document.getElementById("whatsapp-message").value;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
};

window.closeWhatsAppPanel = function () {
  document.getElementById("whatsapp-panel").classList.add("section-hidden");
  whatsappPlayers = [];
};

window.saveResult = async function () {
  const id = document.getElementById("res-match").value;
  const score = document.getElementById("res-score").value.trim();
  if (!id || !score) return;
  await supabase.from("matches").update({ risultato: score, stato: 'passata' }).eq("id", id);
  showMsg('res-success');
  await loadAdminMatches();
};

// ---- PRESENZE ----
async function loadMatchSelectPresenze() {
  const { data } = await supabase.from("matches").select("*").order("data", { ascending: false });
  const sel = document.getElementById("pres-match-select");
  if (!data || !data.length) {
    sel.innerHTML = '<option value="">-- Nessuna partita --</option>';
    return;
  }
  sel.innerHTML = '<option value="">-- Seleziona --</option>' + data.map(m => {
    const dt = new Date(m.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const tag = m.stato === 'passata' ? '' : ' (à venir)';
    return `<option value="${m.id}">${dt} — ${m.avversario}${tag}</option>`;
  }).join('');
}

window.loadPresenze = async function () {
  const matchId = document.getElementById("pres-match-select").value;
  const wrap = document.getElementById("presenze-table-wrap");
  if (!matchId) { wrap.innerHTML = ''; return; }

  const [
    { data: players },
    { data: staff },
    { data: stats },
    { data: dispo },
    { data: guestContacts }
  ] = await Promise.all([
    supabase.from("giocatori").select("*").eq("attivo", true).eq("tipo", "giocatore").order("nome"),
    supabase.from("giocatori").select("*").eq("attivo", true).eq("tipo", "staff").order("ruolo"),
    supabase.from("statistiche").select("*").eq("match_id", matchId),
    supabase.from("disponibilita").select("*").eq("match_id", matchId),
    supabase.from("contatti_ospiti_disponibilita").select("nome,telefono").eq("match_id", matchId)
  ]);

  const statMap = {};
  (stats || []).forEach(s => statMap[s.giocatore_id] = s);
  const dispoMap = {};
  (dispo || []).forEach(d => { dispoMap[d.nome.toLowerCase().trim()] = d.disponibile; });
  const guestContactMap = {};
  (guestContacts || []).forEach(c => { guestContactMap[c.nome.toLowerCase().trim()] = c.telefono; });
  const registeredNames = new Set([
    ...(players || []).map(p => p.nome.toLowerCase().trim()),
    ...(staff || []).map(p => p.nome.toLowerCase().trim())
  ]);

  let html = '';

  // Sezione 1: giocatori registrati
  if (!players || !players.length) {
    html += '<div class="card"><div class="empty-msg">Nessun giocatore registrato. Aggiungili dal tab Joueurs.</div></div>';
  } else {
    html += '<div class="card"><div class="card-title"><i class="ti ti-clipboard-check"></i> Présences — cliquez pour modifier</div>';

    players.forEach(p => {
      const s = statMap[p.id];
      const presente = s && s.presente;
      const initials = escapeHtml(p.nome.split(' ').map(x => x[0]).join('').toUpperCase());
      const safeName = escapeHtml(p.nome);
      const safePhoto = escapeHtml(p.foto_url || '');
      const safePosition = escapeHtml(p.posizione || '');
      // info disponibilità data dal giocatore
      const dispoVal = dispoMap[p.nome.toLowerCase().trim()];
      let dispoTag = '';
      if (dispoVal === true) dispoTag = '<span class="badge badge-win" style="font-size:9px;margin-left:6px">dispo ✓</span>';
      else if (dispoVal === false) dispoTag = '<span class="badge badge-loss" style="font-size:9px;margin-left:6px">pas dispo</span>';

      html += `<div class="pres-row pres-row-stats" id="prow-${p.id}">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:140px;">
          ${p.foto_url
            ? `<img src="${safePhoto}" class="player-photo-sm" onerror="this.style.display='none'">`
            : `<div class="avatar">${initials}</div>`}
          <div>
            <div style="font-size:14px;font-weight:500">${safeName}${dispoTag}</div>
            <span class="badge badge-navy" style="font-size:10px">${safePosition}</span>
          </div>
        </div>
        <div class="pres-controls">
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="pres-btn ${presente ? 'pres-btn-si active-si' : 'pres-btn-si'}" onclick="setPres(${p.id},${matchId},true,'prow-${p.id}')">
              <i class="ti ti-check"></i> Présent
            </button>
            <button class="pres-btn ${!presente && s ? 'pres-btn-no active-no' : 'pres-btn-no'}" onclick="setPres(${p.id},${matchId},false,'prow-${p.id}')">
              <i class="ti ti-x"></i> Absent
            </button>
            <button class="icon-btn icon-btn-del" data-name="${safeName}" onclick="deletePlayer(${p.id},this.dataset.name)" title="Supprimer ce joueur (doublon)"><i class="ti ti-trash"></i></button>
          </div>
          <div class="stat-inputs" id="stat-inputs-${p.id}" style="${presente ? '' : 'display:none'}">
            <label title="Numéro de maillot">👕<input type="number" min="1" max="99" value="${s && s.numero_maglia ? s.numero_maglia : ''}" placeholder="${p.numero || '?'}" id="maglia-${p.id}" onchange="saveStat(${p.id},${matchId},'numero_maglia',this.value)"></label>
            <label>⚽<input type="number" min="0" max="20" value="${s ? (s.gol || 0) : 0}" id="gol-${p.id}" onchange="saveStat(${p.id},${matchId},'gol',this.value)"></label>
            <label>🅰️<input type="number" min="0" max="20" value="${s ? (s.assist || 0) : 0}" id="assist-${p.id}" onchange="saveStat(${p.id},${matchId},'assist',this.value)"></label>
            <label>🟨<input type="number" min="0" max="5" value="${s ? (s.gialli || 0) : 0}" id="gialli-${p.id}" onchange="saveStat(${p.id},${matchId},'gialli',this.value)"></label>
            <label>🟥<input type="number" min="0" max="2" value="${s ? (s.rossi || 0) : 0}" id="rossi-${p.id}" onchange="saveStat(${p.id},${matchId},'rossi',this.value)"></label>
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  // Sezione STAFF: presenze (senza gol/assist/cartellini)
  if (staff && staff.length) {
    html += '<div class="card"><div class="card-title"><i class="ti ti-briefcase"></i> Présences staff</div>';
    staff.forEach(p => {
      const s = statMap[p.id];
      const presente = s && s.presente;
      const initials = escapeHtml(p.nome.split(' ').map(x => x[0]).join('').toUpperCase());
      const safeName = escapeHtml(p.nome);
      const safePhoto = escapeHtml(p.foto_url || '');
      const safeRole = escapeHtml(p.ruolo || 'Staff');
      const dispoVal = dispoMap[p.nome.toLowerCase().trim()];
      let dispoTag = '';
      if (dispoVal === true) dispoTag = '<span class="badge badge-win" style="font-size:9px;margin-left:6px">dispo ✓</span>';
      else if (dispoVal === false) dispoTag = '<span class="badge badge-loss" style="font-size:9px;margin-left:6px">pas dispo</span>';
      html += `<div class="pres-row" id="prow-${p.id}">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:140px;">
          ${p.foto_url
            ? `<img src="${safePhoto}" class="player-photo-sm" onerror="this.style.display='none'">`
            : `<div class="avatar" style="background:#633806">${initials}</div>`}
          <div>
            <div style="font-size:14px;font-weight:500">${safeName}${dispoTag}</div>
            <span class="badge badge-gold" style="font-size:10px">${safeRole}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="pres-btn ${presente ? 'pres-btn-si active-si' : 'pres-btn-si'}" onclick="setPres(${p.id},${matchId},true,'prow-${p.id}')">
            <i class="ti ti-check"></i> Présent
          </button>
          <button class="pres-btn ${!presente && s ? 'pres-btn-no active-no' : 'pres-btn-no'}" onclick="setPres(${p.id},${matchId},false,'prow-${p.id}')">
            <i class="ti ti-x"></i> Absent
          </button>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  if (dispo && dispo.length) {
    const orphans = dispo.filter(d => !registeredNames.has(d.nome.toLowerCase().trim()));
    if (orphans.length) {
      html += '<div class="card"><div class="card-title"><i class="ti ti-user-question"></i> Ont répondu mais pas encore dans l\'effectif</div>';
      orphans.forEach(d => {
        const initials = escapeHtml(d.nome.split(' ').map(x => x[0]).join('').toUpperCase());
        const safeName = escapeHtml(d.nome);
        const guestPhone = guestContactMap[d.nome.toLowerCase().trim()] || '';
        const safePhone = escapeHtml(guestPhone);
        const phoneLine = guestPhone
          ? `<div class="player-phone"><i class="ti ti-brand-whatsapp"></i> ${safePhone}</div>`
          : '<div class="player-phone phone-missing"><i class="ti ti-brand-whatsapp"></i> Téléphone non indiqué</div>';
        const dispoTag = d.disponibile
          ? '<span class="badge badge-win" style="font-size:10px">Disponible</span>'
          : '<span class="badge badge-loss" style="font-size:10px">Pas dispo</span>';
        html += `<div class="pres-row">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <div class="avatar" style="background:#888">${initials}</div>
            <div>
              <div style="font-size:14px;font-weight:500">${safeName}</div>
              ${dispoTag}
              ${phoneLine}
            </div>
          </div>
          <button class="pres-btn" data-name="${safeName}" data-phone="${safePhone}" style="background:#1a2a5e;color:white;border-color:transparent;font-weight:bold;"
            onclick="quickAddPlayer(this.dataset.name,this.dataset.phone)">
            <i class="ti ti-user-plus"></i> Ajouter
          </button>
        </div>`;
      });
      html += '</div>';
    }
  }

  wrap.innerHTML = html;
};

// Aggiunge rapidamente un giocatore che ha dato disponibilità
window.quickAddPlayer = async function (nome, phone = '') {
  const { data: created, error } = await supabase
    .from("giocatori")
    .insert({ nome, posizione: 'M', tipo: 'giocatore', attivo: true })
    .select("id")
    .single();
  if (error) { console.error(error); alert("Erreur: " + error.message); return; }

  if (phone && isValidPhone(phone)) {
    const contactError = await savePlayerContact(created.id, phone, true);
    if (contactError) alert("Joueur ajouté, mais téléphone non enregistré: " + contactError.message);
  }

  await loadPresenze();
  await loadPlayerList();
  const { count } = await supabase.from("giocatori").select("*", { count: "exact", head: true }).eq("tipo", "giocatore").eq("attivo", true);
  document.getElementById("adm-giocatori").textContent = count || 0;
};

window.setPres = async function (playerId, matchId, presente, rowId) {
  const existing = await supabase.from("statistiche").select("id").eq("giocatore_id", playerId).eq("match_id", matchId).single();
  if (existing.data) {
    await supabase.from("statistiche").update({ presente }).eq("id", existing.data.id);
  } else {
    await supabase.from("statistiche").insert({ giocatore_id: playerId, match_id: parseInt(matchId), presente, gol: 0, assist: 0, gialli: 0, rossi: 0 });
  }
  // Aggiorna visualmente
  const row = document.getElementById(rowId);
  if (row) {
    row.querySelectorAll('.pres-btn').forEach(b => b.classList.remove('active-si', 'active-no'));
    if (presente) row.querySelector('.pres-btn-si').classList.add('active-si');
    else row.querySelector('.pres-btn-no').classList.add('active-no');
  }
  // Mostra/nascondi gli input statistiche (gol, assist, cartellini)
  const inputs = document.getElementById(`stat-inputs-${playerId}`);
  if (inputs) inputs.style.display = presente ? '' : 'none';
};

// Salva un singolo dato statistico (gol/assist/gialli/rossi)
window.saveStat = async function (playerId, matchId, campo, valore) {
  const val = parseInt(valore) || 0;
  const existing = await supabase.from("statistiche").select("id").eq("giocatore_id", playerId).eq("match_id", matchId).single();
  if (existing.data) {
    await supabase.from("statistiche").update({ [campo]: val }).eq("id", existing.data.id);
  } else {
    // crea la riga (segna anche presente, dato che ha statistiche)
    const base = { giocatore_id: playerId, match_id: parseInt(matchId), presente: true, gol: 0, assist: 0, gialli: 0, rossi: 0 };
    base[campo] = val;
    await supabase.from("statistiche").insert(base);
  }
};

// ---- GIOCATORI ----
function isValidPhone(phone) {
  return normalizeWhatsAppPhone(phone).length >= 8;
}

async function savePlayerContact(playerId, phone, whatsappEnabled = true) {
  const { error } = await supabase.from("contatti_giocatori").upsert({
    giocatore_id: playerId,
    telefono: phone.trim(),
    whatsapp_attivo: whatsappEnabled,
    updated_at: new Date().toISOString()
  }, { onConflict: "giocatore_id" });
  return error;
}

async function loadPlayerList() {
  const [{ data }, { data: contacts }] = await Promise.all([
    supabase.from("giocatori").select("*").eq("attivo", true).order("nome"),
    supabase.from("contatti_giocatori").select("giocatore_id,telefono,whatsapp_attivo")
  ]);
  const elP = document.getElementById("player-list");
  const elS = document.getElementById("staff-list");
  const all = data || [];
  const contactMap = Object.fromEntries((contacts || []).map(c => [c.giocatore_id, c]));
  const players = all.filter(p => (p.tipo || 'giocatore') === 'giocatore');
  const staff = all.filter(p => p.tipo === 'staff');

  function rowHtml(p, isStaff) {
    const initials = escapeHtml(p.nome.split(' ').map(x => x[0]).join('').toUpperCase());
    const contact = contactMap[p.id];
    const subtitle = isStaff
      ? `<span class="badge badge-gold" style="font-size:10px">${escapeHtml(p.ruolo || 'Staff')}</span>`
      : `<span class="badge badge-navy" style="font-size:10px">${escapeHtml(p.posizione || '')}${p.numero ? ' · #' + p.numero : ''}</span>`;
    const phoneLine = `<div class="player-phone ${contact?.telefono && contact?.whatsapp_attivo !== false ? '' : 'phone-missing'}"><i class="ti ti-brand-whatsapp"></i> ${escapeHtml(contact?.telefono || 'Téléphone manquant')}${contact?.telefono && contact?.whatsapp_attivo === false ? ' · messages refusés' : ''}</div>`;
    return `<div class="pres-row" id="player-row-${p.id}">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${p.foto_url
          ? `<img src="${escapeHtml(p.foto_url)}" class="player-photo-sm" onerror="this.style.display='none'">`
          : `<div class="avatar"${isStaff ? ' style="background:#633806"' : ''}>${initials}</div>`}
        <div>
          <div style="font-size:14px;font-weight:500">${escapeHtml(p.nome)}</div>
          ${subtitle}
          ${phoneLine}
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="icon-btn" onclick="editPlayer(${p.id})" title="Modifier"><i class="ti ti-pencil"></i></button>
        <button class="icon-btn icon-btn-del" data-name="${escapeHtml(p.nome)}" onclick="deletePlayer(${p.id},this.dataset.name)" title="Supprimer"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }

  elP.innerHTML = players.length ? players.map(p => rowHtml(p, false)).join('') : '<div class="empty-msg">Nessun giocatore ancora.</div>';
  if (elS) elS.innerHTML = staff.length ? staff.map(p => rowHtml(p, true)).join('') : '<div class="empty-msg">Nessuno staff ancora.</div>';
}

// Mostra il form di modifica inline per un giocatore o staff
window.editPlayer = async function (id) {
  const [{ data: p }, { data: contact }] = await Promise.all([
    supabase.from("giocatori").select("*").eq("id", id).single(),
    supabase.from("contatti_giocatori").select("telefono,whatsapp_attivo").eq("giocatore_id", id).maybeSingle()
  ]);
  if (!p) return;
  const row = document.getElementById(`player-row-${id}`);
  if (!row) return;
  const isStaff = p.tipo === 'staff';

  const ruoli = ['Entraîneur', 'Entraîneur adjoint', 'Responsable sportif', 'Président', 'Vice-président', 'Responsable médical', 'Kinésithérapeute', 'Préparateur physique', 'Délégué', 'Autre'];

  const giocatoreFields = `<div class="form-grid">
      <div class="form-row">
        <label class="form-lbl">Poste</label>
        <select id="edit-pos-${id}">
          <option value="G" ${p.posizione === 'G' ? 'selected' : ''}>Gardien (G)</option>
          <option value="D" ${p.posizione === 'D' ? 'selected' : ''}>Défenseur (D)</option>
          <option value="M" ${p.posizione === 'M' ? 'selected' : ''}>Milieu (M)</option>
          <option value="A" ${p.posizione === 'A' ? 'selected' : ''}>Attaquant (A)</option>
        </select>
      </div>
      <div class="form-row"><label class="form-lbl">Numéro habituel</label><input type="number" id="edit-num-${id}" value="${p.numero || ''}" min="1" max="99"></div>
    </div>`;

  const contactFields = `<div class="form-row">
      <label class="form-lbl">Téléphone WhatsApp (optionnel)</label>
      <input type="tel" id="edit-phone-${id}" inputmode="tel" value="${(contact?.telefono || '').replace(/"/g, '&quot;')}" placeholder="+33 6 12 34 56 78">
      <div class="simple-help">Nécessaire pour prévenir la personne. Peut rester vide pour l'instant.</div>
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="edit-wa-${id}" ${contact?.whatsapp_attivo === false ? '' : 'checked'}>
      <span>La personne accepte les messages WhatsApp du club</span>
    </label>`;

  const staffFields = `<div class="form-row">
      <label class="form-lbl">Rôle</label>
      <select id="edit-ruolo-${id}">
        ${ruoli.map(r => `<option value="${r}" ${p.ruolo === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>`;

  row.innerHTML = `<div style="width:100%">
    <div class="form-row"><label class="form-lbl">Nom complet</label><input type="text" id="edit-nome-${id}" value="${p.nome.replace(/"/g, '&quot;')}"></div>
    <div class="form-row">
      <label class="form-lbl">Type</label>
      <select id="edit-tipo-${id}" onchange="toggleEditTipo(${id})">
        <option value="giocatore" ${!isStaff ? 'selected' : ''}>Joueur</option>
        <option value="staff" ${isStaff ? 'selected' : ''}>Staff</option>
      </select>
    </div>
    <div id="edit-fields-giocatore-${id}" class="${isStaff ? 'section-hidden' : ''}">${giocatoreFields}</div>
    <div id="edit-fields-staff-${id}" class="${isStaff ? '' : 'section-hidden'}">${staffFields}</div>
    ${contactFields}
    <div class="form-row"><label class="form-lbl">Changer la photo (optionnel)</label><input type="file" id="edit-photo-${id}" accept="image/*"></div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn-primary" style="flex:1" onclick="savePlayer(${id})"><i class="ti ti-device-floppy"></i> Enregistrer</button>
      <button class="btn-outline" onclick="loadPlayerList()"><i class="ti ti-x"></i> Annuler</button>
    </div>
  </div>`;
};

window.toggleEditTipo = function (id) {
  const tipo = document.getElementById(`edit-tipo-${id}`).value;
  document.getElementById(`edit-fields-giocatore-${id}`).classList.toggle('section-hidden', tipo !== 'giocatore');
  document.getElementById(`edit-fields-staff-${id}`).classList.toggle('section-hidden', tipo !== 'staff');
};

// Salva le modifiche del giocatore/staff
window.savePlayer = async function (id) {
  const nome = document.getElementById(`edit-nome-${id}`).value.trim();
  const tipo = document.getElementById(`edit-tipo-${id}`).value;
  const photoFile = document.getElementById(`edit-photo-${id}`).files[0];
  const phone = document.getElementById(`edit-phone-${id}`).value.trim();
  const whatsappEnabled = document.getElementById(`edit-wa-${id}`).checked;
  if (!nome) { alert("Le nom est requis"); return; }
  if (phone && !isValidPhone(phone)) {
    alert("Écris un téléphone complet avec le code du pays.");
    return;
  }

  const updates = { nome, tipo };
  if (tipo === 'giocatore') {
    updates.posizione = document.getElementById(`edit-pos-${id}`).value;
    const num = document.getElementById(`edit-num-${id}`).value;
    updates.numero = num ? parseInt(num) : null;
    updates.ruolo = null;
  } else {
    updates.ruolo = document.getElementById(`edit-ruolo-${id}`).value;
    updates.posizione = null;
  }

  if (photoFile) {
    try {
      const ext = photoFile.name.split('.').pop();
      const path = `players/${id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('foto').upload(path, photoFile, { upsert: true });
      if (!upErr) updates.foto_url = supabase.storage.from('foto').getPublicUrl(path).data.publicUrl;
    } catch (e) { console.warn("Foto non caricata:", e); }
  }

  const { error } = await supabase.from("giocatori").update(updates).eq("id", id);
  if (error) { alert("Erreur: " + error.message); return; }

  if (phone) {
    const contactError = await savePlayerContact(id, phone, whatsappEnabled);
    if (contactError) {
      alert("Personne enregistrée, mais téléphone non enregistré: " + contactError.message);
      return;
    }
  } else {
    await supabase.from("contatti_giocatori").delete().eq("giocatore_id", id);
  }

  await loadPlayerList();
};

// Elimina un giocatore. Se ha statistiche, le rimuove prima, poi elimina del tutto.
window.deletePlayer = async function (id, nome) {
  if (!confirm(`Supprimer ${nome} ?`)) return;
  // Rimuovi prima le statistiche/presenze collegate (per evitare errori di vincolo)
  await supabase.from("statistiche").delete().eq("giocatore_id", id);
  const { error } = await supabase.from("giocatori").delete().eq("id", id);
  if (error) {
    // Se l'eliminazione totale fallisce, ripiega su disattivazione
    await supabase.from("giocatori").update({ attivo: false }).eq("id", id);
  }
  // Aggiorna la vista attiva
  if (document.getElementById("presenze-table-wrap").innerHTML.trim()) await loadPresenze();
  await loadPlayerList();
  const { count } = await supabase.from("giocatori").select("*", { count: "exact", head: true }).eq("attivo", true);
  document.getElementById("adm-giocatori").textContent = count || 0;
};

// Mostra/nasconde i campi a seconda del tipo (giocatore/staff)
window.toggleTipoFields = function () {
  const tipo = document.getElementById("new-player-tipo").value;
  document.getElementById("fields-giocatore").classList.toggle("section-hidden", tipo !== "giocatore");
  document.getElementById("fields-staff").classList.toggle("section-hidden", tipo !== "staff");
};

window.addPlayer = async function () {
  const nome = document.getElementById("new-player-nome").value.trim();
  const tipo = document.getElementById("new-player-tipo").value;
  const pos = document.getElementById("new-player-pos").value;
  const num = document.getElementById("new-player-num").value;
  const phone = document.getElementById("new-player-phone").value.trim();
  const whatsappEnabled = document.getElementById("new-player-wa").checked;
  const ruolo = document.getElementById("new-player-ruolo").value;
  const photoFile = document.getElementById("new-player-photo").files[0];
  const errEl = document.getElementById("player-err");
  if (!nome) {
    errEl.textContent = "Le nom est requis";
    showMsg('player-err');
    return;
  }
  if (phone && !isValidPhone(phone)) {
    errEl.textContent = "Écris un téléphone complet avec le code du pays.";
    showMsg('player-err');
    return;
  }

  // Prova a caricare la foto SE c'è un bucket. Se fallisce, continua comunque senza foto.
  let foto_url = null;
  if (photoFile) {
    try {
      const ext = photoFile.name.split('.').pop();
      const path = `players/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('foto').upload(path, photoFile, { upsert: true });
      if (upErr) {
        console.warn("Foto non caricata (bucket mancante?):", upErr.message);
      } else {
        foto_url = supabase.storage.from('foto').getPublicUrl(path).data.publicUrl;
      }
    } catch (e) {
      console.warn("Errore foto, continuo senza:", e);
    }
  }

  // Costruisci il record a seconda del tipo
  const record = { nome, tipo, attivo: true, foto_url };
  if (tipo === 'giocatore') {
    record.posizione = pos;
    record.numero = num ? parseInt(num) : null;
    record.ruolo = null;
  } else {
    record.ruolo = ruolo;
    record.posizione = null;
  }

  const { data: created, error } = await supabase.from("giocatori").insert(record).select("id").single();
  if (error) {
    console.error("Errore inserimento:", error);
    errEl.textContent = "Erreur: " + error.message;
    showMsg('player-err');
    return;
  }

  if (phone) {
    const contactError = await savePlayerContact(created.id, phone, whatsappEnabled);
    if (contactError) {
      await supabase.from("giocatori").delete().eq("id", created.id);
      errEl.textContent = "Téléphone non enregistré: " + contactError.message;
      showMsg('player-err');
      return;
    }
  }

  document.getElementById("new-player-nome").value = '';
  document.getElementById("new-player-num").value = '';
  document.getElementById("new-player-phone").value = '';
  document.getElementById("new-player-wa").checked = true;
  document.getElementById("new-player-photo").value = '';
  showMsg('player-success');
  await loadPlayerList();
  const { count } = await supabase.from("giocatori").select("*", { count: "exact", head: true }).eq("tipo", "giocatore").eq("attivo", true);
  document.getElementById("adm-giocatori").textContent = count || 0;
};

// ---- FOTO ----
async function loadFotoMatchSelect() {
  const { data } = await supabase.from("matches").select("*").order("data", { ascending: false });
  const sel = document.getElementById("foto-match-select");
  sel.innerHTML = '<option value="">-- Seleziona match --</option>' + (data || []).map(m => {
    const dt = new Date(m.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `<option value="${m.id}">${dt} — ${m.avversario}</option>`;
  }).join('');
  await loadFotoAdmin();
}

async function loadFotoAdmin() {
  const { data: foto } = await supabase.from("foto").select("*, matches(avversario, data)").order("created_at", { ascending: false }).limit(20);
  const el = document.getElementById("foto-list");
  if (!foto || !foto.length) { el.innerHTML = '<div class="empty-msg">Nessuna foto ancora.</div>'; return; }
  el.innerHTML = '<div class="photo-grid">' + foto.map(f => {
    return `<div class="photo-thumb">
      <img src="${f.url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='📷'">
    </div>`;
  }).join('') + '</div>';
}

window.uploadFoto = async function () {
  const matchId = document.getElementById("foto-match-select").value;
  const files = document.getElementById("foto-input").files;
  const caption = document.getElementById("foto-caption").value.trim();
  if (!matchId || !files.length) { showMsg('foto-err'); return; }

  for (const file of files) {
    const ext = file.name.split('.').pop();
    const path = `matches/${matchId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('foto').upload(path, file);
    if (upErr) { console.error(upErr); continue; }
    const publicUrl = supabase.storage.from('foto').getPublicUrl(path).data.publicUrl;
    await supabase.from("foto").insert({ match_id: parseInt(matchId), url: publicUrl, didascalia: caption });
  }

  document.getElementById("foto-input").value = '';
  document.getElementById("foto-caption").value = '';
  showMsg('foto-success');
  await loadFotoAdmin();
};

function showMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}
