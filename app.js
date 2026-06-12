
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co"; // <-- cambia
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";  // <-- incolla la tua anon key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let allMatches = [];
let currentStatType = 'presenze';
 
// ---- INIT ----
document.addEventListener("DOMContentLoaded", async () => {
  await loadMatches();
  renderMatchSelect();
});
 
// ---- CARICA PARTITE ----
async function loadMatches() {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("data", { ascending: true });
 
  if (error) { console.error("Errore caricamento partite:", error); return; }
  allMatches = data || [];
  renderMatches();
}
 
// ---- RENDER PARTITE ----
function renderMatches() {
  const el = document.getElementById("match-list");
  if (!allMatches.length) {
    el.innerHTML = '<div class="empty-msg">Nessuna partita ancora. L\'admin può aggiungerne.</div>';
    return;
  }
  let v = 0, pa = 0, s = 0, played = 0;
  el.innerHTML = allMatches.map(m => {
    const r = getResult(m);
    if (r === 'V') { v++; played++; }
    else if (r === 'N') { pa++; played++; }
    else if (r === 'D') { s++; played++; }
    const bCls = r === 'V' ? 'badge-win' : r === 'N' ? 'badge-draw' : r === 'D' ? 'badge-loss' : 'badge-up';
    const bTxt = r === 'V' ? 'Victoire' : r === 'N' ? 'Nul' : r === 'D' ? 'Défaite' : 'À venir';
    const dt = new Date(m.data + 'T00:00:00');
    const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return `<div class="match-row" onclick="openMatch(${m.id})">
      <div class="match-date">${dateStr}</div>
      <div style="flex:1;">
        <div class="match-teams">${m.tipo === 'Casa' ? '🏠' : '✈️'} ${m.avversario}</div>
        <div class="match-detail">${m.orario || ''} · ${m.campo || ''}${m.risultato ? ' · <strong>' + m.risultato + '</strong>' : ''}</div>
      </div>
      <div><span class="badge ${bCls}">${bTxt}</span></div>
    </div>`;
  }).join('');
  document.getElementById('m-partite').textContent = played;
  document.getElementById('m-vinte').textContent = v;
  document.getElementById('m-pari').textContent = pa;
  document.getElementById('m-perse').textContent = s;
}
 
function getResult(m) {
  if (!m.risultato) return null;
  const p = m.risultato.split('-').map(Number);
  if (m.tipo === 'Casa') return p[0] > p[1] ? 'V' : p[0] === p[1] ? 'N' : 'D';
  return p[1] > p[0] ? 'V' : p[0] === p[1] ? 'N' : 'D';
}
 
// ---- DISPONIBILITA ----
function renderMatchSelect() {
  const sel = document.getElementById("match-select");
  if (!sel) return;
  if (!allMatches.length) {
    sel.innerHTML = '<option value="">-- Nessuna partita --</option>';
    return;
  }
  sel.innerHTML = allMatches.map(m => {
    const dt = new Date(m.data + 'T00:00:00');
    const dateStr = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `<option value="${m.id}">${dateStr} — ${m.avversario}</option>`;
  }).join('');
  loadAvail();
}
 
window.loadAvail = async function () {
  const id = document.getElementById("match-select").value;
  if (!id) return;
  const { data, error } = await supabase
    .from("disponibilita")
    .select("*")
    .eq("match_id", id);
 
  const el = document.getElementById("avail-list");
  if (error || !data || !data.length) {
    el.innerHTML = '<div class="empty-msg">Aucune réponse pour ce match.</div>';
    return;
  }
  const si = data.filter(a => a.disponibile);
  const no = data.filter(a => !a.disponibile);
  el.innerHTML =
    (si.length ? `<div class="divider-label">✅ Disponibles (${si.length})</div>` + si.map(a => `<div class="avail-item"><div style="flex:1">${a.nome}</div><span class="badge badge-win">Oui</span></div>`).join('') : '') +
    (no.length ? `<div class="divider-label" style="margin-top:10px;">❌ Pas disponibles (${no.length})</div>` + no.map(a => `<div class="avail-item"><div style="flex:1">${a.nome}</div><span class="badge badge-loss">Non</span></div>`).join('') : '');
};
 
window.submitAvail = async function (ok) {
  const nome = (document.getElementById("avail-nome").value || '').trim();
  const cognome = (document.getElementById("avail-cognome").value || '').trim();
  const id = document.getElementById("match-select").value;
  if (!nome || !cognome || !id) { showMsg('avail-err', true); return; }
  const full = nome + ' ' + cognome;
  const { error } = await supabase.from("disponibilita").upsert(
    { match_id: parseInt(id), nome: full, disponibile: ok },
    { onConflict: 'match_id,nome' }
  );
  if (error) { console.error(error); return; }
  document.getElementById("avail-nome").value = '';
  document.getElementById("avail-cognome").value = '';
  showMsg('avail-success');
  loadAvail();
};
 
// ---- STATISTICHE ----
window.switchStat = async function (type, btn) {
  document.querySelectorAll('.tab-sub-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentStatType = type;
  await loadStats(type);
};
 
async function loadStats(type) {
  const { data: players, error } = await supabase
    .from("giocatori")
    .select("*, statistiche(*)")
    .eq("attivo", true);
 
  const el = document.getElementById("stat-content");
  const titleEl = document.getElementById("stat-title");
  if (error || !players || !players.length) {
    el.innerHTML = '<div class="empty-msg">Nessun giocatore ancora. Aggiungili dal pannello admin.</div>';
    return;
  }
 
  const titles = { presenze: 'Présences joueurs', gol: 'Buts & Passes décisives', cartellini: 'Cartons' };
  titleEl.innerHTML = `<i class="ti ti-chart-bar"></i> ${titles[type]}`;
 
  const computed = players.map(p => {
    const stats = p.statistiche || [];
    return {
      nome: p.nome, pos: p.posizione,
      presenze: stats.filter(s => s.presente).length,
      gol: stats.reduce((a, s) => a + (s.gol || 0), 0),
      assist: stats.reduce((a, s) => a + (s.assist || 0), 0),
      gialli: stats.reduce((a, s) => a + (s.gialli || 0), 0),
      rossi: stats.reduce((a, s) => a + (s.rossi || 0), 0),
    };
  });
 
  if (type === 'presenze') computed.sort((a, b) => b.presenze - a.presenze);
  else if (type === 'gol') computed.sort((a, b) => (b.gol + b.assist) - (a.gol + a.assist));
  else computed.sort((a, b) => (b.gialli + b.rossi * 2) - (a.gialli + a.rossi * 2));
 
  const posCol = { G: 'badge-navy', D: 'badge-navy', M: 'badge-gold', A: 'badge-red' };
  let html = '<table class="stat-table"><thead><tr>';
 
  if (type === 'presenze') {
    html += '<th style="width:28px">#</th><th>Joueur</th><th style="width:30px">P</th><th style="width:50px;text-align:center">Match</th></tr></thead><tbody>';
    computed.forEach((p, i) => {
      html += `<tr><td style="color:#aaa">${i + 1}</td><td><div style="display:flex;align-items:center"><div class="avatar">${p.nome.split(' ').map(x => x[0]).join('')}</div>${p.nome}</div></td><td><span class="badge ${posCol[p.pos] || 'badge-navy'}">${p.pos}</span></td><td class="stat-num">${p.presenze}</td></tr>`;
    });
  } else if (type === 'gol') {
    html += '<th style="width:28px">#</th><th>Joueur</th><th style="width:30px">P</th><th style="width:42px;text-align:center">Buts</th><th style="width:42px;text-align:center">PD</th><th style="width:50px;text-align:center">Total</th></tr></thead><tbody>';
    computed.forEach((p, i) => {
      html += `<tr><td style="color:#aaa">${i + 1}</td><td><div style="display:flex;align-items:center"><div class="avatar">${p.nome.split(' ').map(x => x[0]).join('')}</div>${p.nome}</div></td><td><span class="badge ${posCol[p.pos] || 'badge-navy'}">${p.pos}</span></td><td class="stat-num">${p.gol}</td><td class="stat-num">${p.assist}</td><td class="stat-num">${p.gol + p.assist}</td></tr>`;
    });
  } else {
    html += '<th style="width:28px">#</th><th>Joueur</th><th style="width:30px">P</th><th style="width:54px;text-align:center">Jaunes</th><th style="width:54px;text-align:center">Rouges</th></tr></thead><tbody>';
    computed.forEach((p, i) => {
      html += `<tr><td style="color:#aaa">${i + 1}</td><td><div style="display:flex;align-items:center"><div class="avatar">${p.nome.split(' ').map(x => x[0]).join('')}</div>${p.nome}</div></td><td><span class="badge ${posCol[p.pos] || 'badge-navy'}">${p.pos}</span></td><td class="stat-num">${p.gialli ? `<span class="badge badge-gold">${p.gialli}</span>` : '-'}</td><td class="stat-num">${p.rossi ? `<span class="badge badge-red">${p.rossi}</span>` : '-'}</td></tr>`;
    });
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}
 
// ---- UTILS ----
function showMsg(id, isErr = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2500);
}
 
// ---- TAB SWITCHING ----
window.switchTab = function (name) {
  ['partite', 'disponibilita', 'statistiche', 'galleria'].forEach(t => {
    document.getElementById('sec-' + t)?.classList.toggle('section-hidden', t !== name);
    document.getElementById('tab-' + t)?.classList.toggle('active', t === name);
  });
  if (name === 'disponibilita') renderMatchSelect();
  if (name === 'statistiche') loadStats('presenze');
};
 
window.openMatch = function (id) {
  switchTab('disponibilita');
  setTimeout(() => {
    const sel = document.getElementById('match-select');
    if (sel) { sel.value = id; loadAvail(); }
  }, 100);
};