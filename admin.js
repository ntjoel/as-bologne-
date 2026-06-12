import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";
const ADMIN_PASSWORD = "admin123+";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("asbologne_admin") === "true") showPanel();
});

// ---- AUTH (solo password, no email) ----
window.adminLogin = function () {
  const pw = document.getElementById("admin-pw").value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem("asbologne_admin", "true");
    showPanel();
  } else {
    showMsg('login-err');
  }
};

window.adminLogout = function () {
  sessionStorage.removeItem("asbologne_admin");
  document.getElementById("admin-area").classList.add("section-hidden");
  document.getElementById("login-area").classList.remove("section-hidden");
  document.getElementById("admin-pw").value = '';
};

async function showPanel() {
  document.getElementById("login-area").classList.add("section-hidden");
  document.getElementById("admin-area").classList.remove("section-hidden");
  await loadAllData();
}

// ---- LOAD ALL ----
async function loadAllData() {
  const [{ count: mc }, { count: dc }, { count: gc }] = await Promise.all([
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("disponibilita").select("*", { count: "exact", head: true }),
    supabase.from("giocatori").select("*", { count: "exact", head: true }),
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
  ['matches', 'presenze', 'giocatori', 'foto'].forEach(t => {
    document.getElementById('adm-tab-' + t)?.classList.toggle('section-hidden', t !== name);
  });
  document.querySelectorAll('.tab-sub-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (name === 'presenze') loadMatchSelectPresenze();
  if (name === 'foto') loadFotoMatchSelect();
};

// ---- MATCHES ----
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
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #f0f0f0;">
      <div style="flex:1;font-size:13px;">${dt} — <strong>${m.avversario}</strong> (${m.tipo === 'Casa' ? 'Dom.' : 'Ext.'})</div>
      <span class="badge ${bCls}">${m.risultato || 'À venir'}</span>
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

window.addMatch = async function () {
  const data = document.getElementById("new-data").value;
  const avv = document.getElementById("new-avv").value.trim();
  if (!data || !avv) { showMsg('match-err'); return; }
  const { error } = await supabase.from("matches").insert({
    data, avversario: avv,
    tipo: document.getElementById("new-ht").value,
    orario: document.getElementById("new-ora").value,
    campo: document.getElementById("new-campo").value.trim(),
    risultato: '', stato: 'futura'
  });
  if (error) { console.error(error); return; }
  document.getElementById("new-data").value = '';
  document.getElementById("new-avv").value = '';
  document.getElementById("new-campo").value = '';
  showMsg('match-success');
  await loadAdminMatches();
  const { count } = await supabase.from("matches").select("*", { count: "exact", head: true });
  document.getElementById("adm-matches").textContent = count || 0;
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
  const { data } = await supabase.from("matches").select("*").eq("stato", "passata").order("data", { ascending: false });
  const sel = document.getElementById("pres-match-select");
  if (!data || !data.length) {
    sel.innerHTML = '<option value="">-- Nessuna partita giocata --</option>';
    return;
  }
  sel.innerHTML = '<option value="">-- Seleziona --</option>' + data.map(m => {
    const dt = new Date(m.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `<option value="${m.id}">${dt} — ${m.avversario}</option>`;
  }).join('');
}

window.loadPresenze = async function () {
  const matchId = document.getElementById("pres-match-select").value;
  const wrap = document.getElementById("presenze-table-wrap");
  if (!matchId) { wrap.innerHTML = ''; return; }

  const { data: players } = await supabase.from("giocatori").select("*").eq("attivo", true).order("nome");
  if (!players || !players.length) {
    wrap.innerHTML = '<div class="card"><div class="empty-msg">Nessun giocatore.</div></div>';
    return;
  }

  const { data: stats } = await supabase.from("statistiche").select("*").eq("match_id", matchId);
  const statMap = {};
  (stats || []).forEach(s => statMap[s.giocatore_id] = s);

  let html = '<div class="card"><div class="card-title"><i class="ti ti-clipboard-check"></i> Présences — cliquez pour modifier</div>';
  players.forEach(p => {
    const s = statMap[p.id];
    const presente = s && s.presente;
    const initials = p.nome.split(' ').map(x => x[0]).join('').toUpperCase();
    html += `<div class="pres-row" id="prow-${p.id}">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${p.foto_url
          ? `<img src="${p.foto_url}" class="player-photo-sm" onerror="this.style.display='none'">`
          : `<div class="avatar">${initials}</div>`}
        <div>
          <div style="font-size:14px;font-weight:500">${p.nome}</div>
          <span class="badge badge-navy" style="font-size:10px">${p.posizione}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
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
  wrap.innerHTML = html;
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
};

// ---- GIOCATORI ----
async function loadPlayerList() {
  const { data } = await supabase.from("giocatori").select("*").eq("attivo", true).order("nome");
  const el = document.getElementById("player-list");
  if (!data || !data.length) { el.innerHTML = '<div class="empty-msg">Nessun giocatore ancora.</div>'; return; }
  el.innerHTML = data.map(p => {
    const initials = p.nome.split(' ').map(x => x[0]).join('').toUpperCase();
    return `<div class="pres-row">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${p.foto_url
          ? `<img src="${p.foto_url}" class="player-photo-sm" onerror="this.style.display='none'">`
          : `<div class="avatar">${initials}</div>`}
        <div>
          <div style="font-size:14px;font-weight:500">${p.nome}</div>
          <span class="badge badge-navy" style="font-size:10px">${p.posizione}${p.numero ? ' · #' + p.numero : ''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.addPlayer = async function () {
  const nome = document.getElementById("new-player-nome").value.trim();
  const pos = document.getElementById("new-player-pos").value;
  const num = document.getElementById("new-player-num").value;
  const photoFile = document.getElementById("new-player-photo").files[0];
  if (!nome) return;

  let foto_url = null;
  if (photoFile) {
    const ext = photoFile.name.split('.').pop();
    const path = `players/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('foto').upload(path, photoFile, { upsert: true });
    if (!upErr) foto_url = path;
  }

  const { error } = await supabase.from("giocatori").insert({ nome, posizione: pos, numero: num ? parseInt(num) : null, attivo: true, foto_url });
  if (error) { console.error(error); showMsg('player-err'); return; }
  document.getElementById("new-player-nome").value = '';
  document.getElementById("new-player-num").value = '';
  document.getElementById("new-player-photo").value = '';
  showMsg('player-success');
  await loadPlayerList();
  const { count } = await supabase.from("giocatori").select("*", { count: "exact", head: true });
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
    const url = supabase.storage.from('foto').getPublicUrl(f.url).data.publicUrl;
    return `<div class="photo-thumb">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='📷'">
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
    await supabase.from("foto").insert({ match_id: parseInt(matchId), url: path, didascalia: caption });
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
