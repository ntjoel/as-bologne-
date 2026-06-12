import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// STESSE CREDENZIALI DI app.js
// ============================================================
const SUPABASE_URL = "https://TUO-PROGETTO.supabase.co";   // <-- cambia
const SUPABASE_KEY = "eyJ...";                              // <-- cambia
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
});

// ---- AUTH ----
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) showPanel();
}

window.adminLogin = async function () {
  const email = document.getElementById("admin-email").value.trim();
  const pw = document.getElementById("admin-pw").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) { showMsg('login-err', true); return; }
  showPanel();
};

window.adminLogout = async function () {
  await supabase.auth.signOut();
  document.getElementById("admin-area").classList.add("section-hidden");
  document.getElementById("login-area").classList.remove("section-hidden");
};

async function showPanel() {
  document.getElementById("login-area").classList.add("section-hidden");
  document.getElementById("admin-area").classList.remove("section-hidden");
  await loadAdminData();
}

// ---- CARICA DATI ----
async function loadAdminData() {
  const [{ count: mc }, { count: dc }, { count: gc }] = await Promise.all([
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("disponibilita").select("*", { count: "exact", head: true }),
    supabase.from("giocatori").select("*", { count: "exact", head: true }),
  ]);
  document.getElementById("adm-matches").textContent = mc || 0;
  document.getElementById("adm-risposte").textContent = dc || 0;
  document.getElementById("adm-giocatori").textContent = gc || 0;
  await loadAdminMatches();
}

async function loadAdminMatches() {
  const { data } = await supabase.from("matches").select("*").order("data", { ascending: false }).limit(10);
  const el = document.getElementById("admin-match-list");
  const sel = document.getElementById("res-match");
  if (!data || !data.length) {
    el.innerHTML = '<div class="empty-msg">Nessuna partita ancora.</div>';
    sel.innerHTML = '<option value="">-- Nessuna partita --</option>';
    return;
  }
  el.innerHTML = data.map(m => {
    const r = getResult(m);
    const bCls = r === 'V' ? 'badge-win' : r === 'N' ? 'badge-draw' : r === 'D' ? 'badge-loss' : 'badge-up';
    const dt = new Date(m.data + 'T00:00:00');
    const dateStr = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;">
      <div style="flex:1;font-size:13px;">${dateStr} — <strong>${m.avversario}</strong> (${m.tipo})</div>
      <span class="badge ${bCls}">${m.risultato || 'À venir'}</span>
    </div>`;
  }).join('');
  sel.innerHTML = data.map(m => {
    const dt = new Date(m.data + 'T00:00:00');
    const dateStr = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `<option value="${m.id}">${dateStr} — ${m.avversario}</option>`;
  }).join('');
}

function getResult(m) {
  if (!m.risultato) return null;
  const p = m.risultato.split('-').map(Number);
  if (m.tipo === 'Casa') return p[0] > p[1] ? 'V' : p[0] === p[1] ? 'N' : 'D';
  return p[1] > p[0] ? 'V' : p[0] === p[1] ? 'N' : 'D';
}

// ---- AGGIUNGI PARTITA ----
window.addMatch = async function () {
  const data = document.getElementById("new-data").value;
  const avv = document.getElementById("new-avv").value.trim();
  const ht = document.getElementById("new-ht").value;
  const ora = document.getElementById("new-ora").value;
  const campo = document.getElementById("new-campo").value.trim();
  if (!data || !avv) { showMsg('match-err', true); return; }
  const { error } = await supabase.from("matches").insert({
    data, avversario: avv, tipo: ht, orario: ora, campo, risultato: '', stato: 'futura'
  });
  if (error) { console.error(error); return; }
  document.getElementById("new-data").value = '';
  document.getElementById("new-avv").value = '';
  document.getElementById("new-campo").value = '';
  showMsg('match-success');
  await loadAdminData();
};

// ---- SALVA RISULTATO ----
window.saveResult = async function () {
  const id = document.getElementById("res-match").value;
  const score = document.getElementById("res-score").value.trim();
  if (!id || !score) return;
  const { error } = await supabase.from("matches").update({ risultato: score, stato: 'passata' }).eq("id", id);
  if (error) { console.error(error); return; }
  showMsg('res-success');
  await loadAdminMatches();
};

// ---- AGGIUNGI GIOCATORE ----
window.addPlayer = async function () {
  const nome = document.getElementById("new-player-nome").value.trim();
  const pos = document.getElementById("new-player-pos").value;
  if (!nome) return;
  const { error } = await supabase.from("giocatori").insert({ nome, posizione: pos, attivo: true });
  if (error) { console.error(error); return; }
  document.getElementById("new-player-nome").value = '';
  showMsg('player-success');
  const { count } = await supabase.from("giocatori").select("*", { count: "exact", head: true });
  document.getElementById("adm-giocatori").textContent = count || 0;
};

// ---- UTILS ----
function showMsg(id, isErr = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2500);
}
