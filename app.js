import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let allMatches = [];

document.addEventListener("DOMContentLoaded", async () => {
  applyStoredLogo();
  await loadMatches();
});

// Carica il logo salvato dall'admin e lo applica alla topbar
async function applyStoredLogo() {
  try {
    const { data } = await supabase.from("impostazioni").select("valore").eq("chiave", "logo_url").single();
    if (data && data.valore) {
      document.querySelectorAll('.topbar-crest img').forEach(img => { img.src = data.valore; });
    }
  } catch (e) { /* tabella non ancora creata, ignora */ }
}

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
let currentStatType = 'presenze';

window.switchStat = function (type, btn) {
  document.querySelectorAll('#sec-statistiche .tab-sub-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentStatType = type;
  loadStats();
};

async function loadStats() {
  const el = document.getElementById("stat-content");
  const titleEl = document.getElementById("stat-title");
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

  const { data: stats } = await supabase.from("statistiche").select("*");
  const statMap = {};
  (stats || []).forEach(s => { statMap[`${s.giocatore_id}_${s.match_id}`] = s; });

  const titles = { presenze: 'Présences joueurs', gol: 'Buts & Passes décisives', cartellini: 'Cartons' };
  const icons = { presenze: 'ti-clipboard-check', gol: 'ti-ball-football', cartellini: 'ti-cards' };
  titleEl.innerHTML = `<i class="ti ${icons[currentStatType]}"></i> ${titles[currentStatType]}`;

  const posCol = { G: 'badge-navy', D: 'badge-navy', M: 'badge-gold', A: 'badge-red' };

  function playerCell(p) {
    const photoUrl = p.foto_url
      ? `<img src="${p.foto_url}" class="player-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
      : '';
    const initials = p.nome.split(' ').map(x => x[0]).join('').toUpperCase();
    return `<div class="player-cell">
      ${photoUrl}
      <div class="avatar" style="${p.foto_url ? 'display:none' : ''}">${initials}</div>
      <div class="player-info">
        <div class="player-name">${p.nome}</div>
        <span class="badge ${posCol[p.posizione] || 'badge-navy'}" style="font-size:10px">${p.posizione}</span>
      </div>
    </div>`;
  }

  let html = '';

  // ---------- PRESENZE: griglia per partita + % ----------
  if (currentStatType === 'presenze') {
    html = `<div style="overflow-x:auto;"><table class="stat-table-full"><thead><tr><th class="th-player">Joueur</th>`;
    playedMatches.forEach(m => {
      const d = new Date(m.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      html += `<th class="th-match" title="${m.avversario}">${d}<br><span style="font-size:10px;font-weight:normal;">${m.avversario.split(' ')[0]}</span></th>`;
    });
    html += `<th class="th-total">Total</th><th class="th-total" style="background:#1a7a1a !important">%</th></tr></thead><tbody>`;

    players.forEach(p => {
      html += `<tr><td class="td-player">${playerCell(p)}</td>`;
      let total = 0;
      playedMatches.forEach(m => {
        const s = statMap[`${p.id}_${m.id}`];
        const presente = s && s.presente;
        if (presente) total++;
        html += `<td class="td-pres">${presente ? '<span class="pres-si">✓</span>' : '<span class="pres-no">✗</span>'}</td>`;
      });
      const pct = Math.round(total / playedMatches.length * 100);
      html += `<td class="td-total">${total}</td><td class="td-total" style="background:#eaf3de;color:#27500a">${pct}%</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  // ---------- GOL & ASSIST ----------
  else if (currentStatType === 'gol') {
    const rows = players.map(p => {
      let gol = 0, assist = 0;
      playedMatches.forEach(m => {
        const s = statMap[`${p.id}_${m.id}`];
        if (s) { gol += s.gol || 0; assist += s.assist || 0; }
      });
      return { p, gol, assist };
    }).sort((a, b) => (b.gol + b.assist) - (a.gol + a.assist));

    html = `<div style="overflow-x:auto;"><table class="stat-table"><thead><tr>
      <th style="width:28px">#</th><th>Joueur</th>
      <th style="width:46px;text-align:center">Buts</th>
      <th style="width:46px;text-align:center">Passes</th>
      <th style="width:52px;text-align:center">Total</th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      html += `<tr><td style="color:#aaa">${i + 1}</td><td>${playerCell(r.p)}</td>
        <td class="stat-num">${r.gol}</td><td class="stat-num">${r.assist}</td>
        <td class="stat-num" style="color:#1a2a5e">${r.gol + r.assist}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  // ---------- CARTELLINI ----------
  else {
    const rows = players.map(p => {
      let gialli = 0, rossi = 0;
      playedMatches.forEach(m => {
        const s = statMap[`${p.id}_${m.id}`];
        if (s) { gialli += s.gialli || 0; rossi += s.rossi || 0; }
      });
      return { p, gialli, rossi };
    }).sort((a, b) => (b.gialli + b.rossi * 2) - (a.gialli + a.rossi * 2));

    html = `<div style="overflow-x:auto;"><table class="stat-table"><thead><tr>
      <th style="width:28px">#</th><th>Joueur</th>
      <th style="width:60px;text-align:center">🟨 Jaunes</th>
      <th style="width:60px;text-align:center">🟥 Rouges</th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      html += `<tr><td style="color:#aaa">${i + 1}</td><td>${playerCell(r.p)}</td>
        <td class="stat-num">${r.gialli ? `<span class="badge badge-gold">${r.gialli}</span>` : '-'}</td>
        <td class="stat-num">${r.rossi ? `<span class="badge badge-red">${r.rossi}</span>` : '-'}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }

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
      html += `<div class="photo-thumb">
        <img src="${f.url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='<i class=ti ti-photo style=font-size:24px></i>'">
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
