import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let allMatches = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadMatches();
});

// ---- MATCHES ----
async function loadMatches() {
  const { data, error } = await supabase.from("matches").select("*").order("data", { ascending: true });
  if (error) { console.error(error); return; }
  allMatches = data || [];
  renderMatches();
  renderMatchSelect();
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getResult(m) {
  if (!m.risultato) return null;
  const p = m.risultato.split('-').map(Number);
  if (m.tipo === 'Casa') return p[0] > p[1] ? 'V' : p[0] === p[1] ? 'N' : 'D';
  return p[1] > p[0] ? 'V' : p[0] === p[1] ? 'N' : 'D';
}

function renderMatches() {
  const el = document.getElementById("match-list");
  if (!allMatches.length) { el.innerHTML = '<div class="empty-msg">Nessuna partita ancora.</div>'; return; }
  let v = 0, pa = 0, s = 0, played = 0;
  el.innerHTML = allMatches.map(m => {
    const r = getResult(m);
    if (r === 'V') { v++; played++; } else if (r === 'N') { pa++; played++; } else if (r === 'D') { s++; played++; }
    const bCls = r === 'V' ? 'badge-win' : r === 'N' ? 'badge-draw' : r === 'D' ? 'badge-loss' : 'badge-up';
    const bTxt = r === 'V' ? 'Victoire' : r === 'N' ? 'Nul' : r === 'D' ? 'Défaite' : 'À venir';
    return `<div class="match-row" onclick="openMatch(${m.id})">
      <div class="match-date">${fmtDate(m.data)}</div>
      <div style="flex:1">
        <div class="match-teams">${m.tipo === 'Casa' ? '🏠' : '✈️'} ${m.avversario}</div>
        <div class="match-detail">${m.orario || ''} · ${m.campo || ''}${m.risultato ? ' · <strong>' + m.risultato + '</strong>' : ''}</div>
      </div>
      <span class="badge ${bCls}">${bTxt}</span>
    </div>`;
  }).join('');
  document.getElementById('m-partite').textContent = played;
  document.getElementById('m-vinte').textContent = v;
  document.getElementById('m-pari').textContent = pa;
  document.getElementById('m-perse').textContent = s;
}

// ---- DISPONIBILITA ----
function renderMatchSelect() {
  const sel = document.getElementById("match-select");
  if (!sel) return;
  if (!allMatches.length) { sel.innerHTML = '<option value="">-- Nessuna partita --</option>'; return; }
  sel.innerHTML = allMatches.map(m =>
    `<option value="${m.id}">${fmtDate(m.data)} — ${m.avversario}</option>`
  ).join('');
  loadAvail();
}

window.loadAvail = async function () {
  const id = document.getElementById("match-select").value;
  const el = document.getElementById("avail-list");
  if (!id) { el.innerHTML = '<div class="empty-msg">Sélectionne un match.</div>'; return; }
  const { data } = await supabase.from("disponibilita").select("*").eq("match_id", id).order("nome");
  if (!data || !data.length) { el.innerHTML = '<div class="empty-msg">Aucune réponse pour ce match.</div>'; return; }
  const si = data.filter(a => a.disponibile), no = data.filter(a => !a.disponibile);
  el.innerHTML =
    (si.length ? `<div class="divider-label">✅ Disponibles (${si.length})</div>` + si.map(a => `<div class="avail-item"><div style="flex:1">${a.nome}</div><span class="badge badge-win">Oui</span></div>`).join('') : '') +
    (no.length ? `<div class="divider-label" style="margin-top:10px">❌ Pas disponibles (${no.length})</div>` + no.map(a => `<div class="avail-item"><div style="flex:1">${a.nome}</div><span class="badge badge-loss">Non</span></div>`).join('') : '');
};

window.submitAvail = async function (ok) {
  const nome = (document.getElementById("avail-nome").value || '').trim();
  const cognome = (document.getElementById("avail-cognome").value || '').trim();
  const id = document.getElementById("match-select").value;
  if (!nome || !cognome || !id) { showMsg('avail-err'); return; }
  const { error } = await supabase.from("disponibilita").upsert(
    { match_id: parseInt(id), nome: nome + ' ' + cognome, disponibile: ok },
    { onConflict: 'match_id,nome' }
  );
  if (error) { console.error(error); return; }
  document.getElementById("avail-nome").value = '';
  document.getElementById("avail-cognome").value = '';
  showMsg('avail-success');
  loadAvail();
};

// ---- STATISTICHE con foto e presenze ----
async function loadStats() {
  const el = document.getElementById("stat-content");
  el.innerHTML = '<div class="empty-msg">Chargement...</div>';

  const { data: players, error: pe } = await supabase.from("giocatori").select("*").eq("attivo", true).order("nome");
  const { data: matches, error: me } = await supabase.from("matches").select("id, avversario, data, stato").order("data");

  if (pe || me || !players || !players.length) {
    el.innerHTML = '<div class="empty-msg">Nessun giocatore ancora. Aggiungili dal pannello admin.</div>';
    return;
  }

  const playedMatches = matches ? matches.filter(m => m.stato === 'passata') : [];

  if (!playedMatches.length) {
    el.innerHTML = '<div class="empty-msg">Nessuna partita giocata ancora.</div>';
    return;
  }

  // Carica tutte le presenze
  const { data: presenze } = await supabase.from("statistiche").select("*");
  const presMap = {};
  (presenze || []).forEach(p => {
    const key = `${p.giocatore_id}_${p.match_id}`;
    presMap[key] = p;
  });

  let html = `<div style="overflow-x:auto;">
    <table class="stat-table-full">
      <thead>
        <tr>
          <th class="th-player">Joueur</th>`;

  playedMatches.forEach(m => {
    const dt = new Date(m.data + 'T00:00:00');
    const d = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    html += `<th class="th-match" title="${m.avversario}">${d}<br><span style="font-size:10px;font-weight:normal;">${m.avversario.split(' ')[0]}</span></th>`;
  });
  html += `<th class="th-total">Total</th></tr></thead><tbody>`;

  players.forEach(p => {
    const photoUrl = p.foto_url
      ? `<img src="${p.foto_url}" class="player-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
      : '';
    const initials = p.nome.split(' ').map(x => x[0]).join('').toUpperCase();
    html += `<tr>
      <td class="td-player">
        <div class="player-cell">
          ${photoUrl}
          <div class="avatar" style="${p.foto_url ? 'display:none' : ''}">${initials}</div>
          <div class="player-info">
            <div class="player-name">${p.nome}</div>
            <span class="badge badge-navy" style="font-size:10px">${p.posizione}</span>
          </div>
        </div>
      </td>`;

    let total = 0;
    playedMatches.forEach(m => {
      const key = `${p.id}_${m.id}`;
      const pres = presMap[key];
      const presente = pres && pres.presente;
      if (presente) total++;
      html += `<td class="td-pres">${presente
        ? '<span class="pres-si">✓</span>'
        : '<span class="pres-no">✗</span>'
      }</td>`;
    });

    html += `<td class="td-total">${total}</td></tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ---- GALLERIA ----
async function loadGalleria() {
  const el = document.getElementById("galleria-content");
  const { data: matches } = await supabase.from("matches").select("id, avversario, data").order("data", { ascending: false });
  const { data: foto } = await supabase.from("foto").select("*").order("created_at", { ascending: false });

  if (!foto || !foto.length) {
    el.innerHTML = '<div class="empty-msg" style="padding:30px 0">Nessuna foto ancora.</div>';
    return;
  }

  const matchMap = {};
  (matches || []).forEach(m => matchMap[m.id] = m);

  const byMatch = {};
  foto.forEach(f => {
    if (!byMatch[f.match_id]) byMatch[f.match_id] = [];
    byMatch[f.match_id].push(f);
  });

  let html = '';
  Object.keys(byMatch).forEach(mid => {
    const m = matchMap[mid];
    const label = m ? `${m.avversario} — ${fmtDate(m.data)}` : 'Match';
    html += `<div class="card">
      <div class="card-title"><i class="ti ti-photo"></i> ${label}</div>
      <div class="photo-grid">`;
    byMatch[mid].forEach(f => {
      const url = supabase.storage.from('foto').getPublicUrl(f.url).data.publicUrl;
      html += `<div class="photo-thumb">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='<i class=ti ti-photo style=font-size:24px></i>'">
      </div>`;
    });
    html += `</div></div>`;
  });
  el.innerHTML = html;
}

// ---- TAB ----
window.switchTab = function (name) {
  ['partite', 'disponibilita', 'statistiche', 'galleria'].forEach(t => {
    document.getElementById('sec-' + t)?.classList.toggle('section-hidden', t !== name);
    document.getElementById('tab-' + t)?.classList.toggle('active', t === name);
  });
  if (name === 'disponibilita') renderMatchSelect();
  if (name === 'statistiche') loadStats();
  if (name === 'galleria') loadGalleria();
};

window.openMatch = function (id) {
  switchTab('disponibilita');
  setTimeout(() => { const s = document.getElementById('match-select'); if (s) { s.value = id; loadAvail(); } }, 150);
};

function showMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2500);
}
