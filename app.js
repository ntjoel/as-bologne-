import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let allMatches = [];
let availabilityOpen = true;
let availIdentityConfirmed = false;
let availPlayers = new Map();
let galleryPhotos = [];
let currentGalleryPhotoIndex = null;
let currentGalleryZoom = 1;

document.addEventListener("DOMContentLoaded", async () => {
  applyStoredLogo();
  await loadMatches();
  const requestedMatch = parseInt(new URLSearchParams(window.location.search).get("match"));
  if (requestedMatch && allMatches.some(m => m.id === requestedMatch)) {
    window.openMatch(requestedMatch);
  }
});

document.addEventListener("keydown", event => {
  const playerViewerOpen = !document.getElementById("player-stats-viewer")?.classList.contains("section-hidden");
  if (playerViewerOpen && event.key === "Escape") {
    window.closePlayerStats();
    return;
  }
  if (document.getElementById("photo-viewer")?.classList.contains("section-hidden")) return;
  if (event.key === "Escape") window.closeGalleryPhoto();
  if (event.key === "+" || event.key === "=") window.zoomGalleryPhoto(0.25);
  if (event.key === "-") window.zoomGalleryPhoto(-0.25);
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

function fmtDeadline(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
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

function getSelectedMatch() {
  const id = parseInt(document.getElementById("match-select")?.value);
  return allMatches.find(m => m.id === id);
}

function isAvailabilityOpen(match) {
  if (!match) return false;
  const matchDay = new Date(match.data + 'T23:59:59');
  if (Date.now() > matchDay.getTime()) return false;
  if (!match.scadenza_disponibilita) return true;
  return Date.now() <= new Date(match.scadenza_disponibilita).getTime();
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
        ${!r && m.scadenza_disponibilita ? `<div class="match-deadline"><i class="ti ti-clock"></i> Répondre avant ${fmtDeadline(m.scadenza_disponibilita)}</div>` : ''}
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
  sel.replaceChildren();
  if (!allMatches.length) {
    sel.add(new Option("-- Nessuna partita --", ""));
    return;
  }
  allMatches.forEach(match => {
    sel.add(new Option(`${fmtDate(match.data)} — ${match.avversario}`, String(match.id)));
  });
  const defaultMatch = allMatches.find(match => isAvailabilityOpen(match)) ||
    allMatches[allMatches.length - 1];
  sel.value = String(defaultMatch.id);
  loadAvail();
  loadAvailPlayers();
}

// Popola il menu a tendina con tutte le persone attive della rosa e dello staff
async function loadAvailPlayers() {
  const sel = document.getElementById("avail-player-select");
  if (!sel) return;
  const { data } = await supabase
    .from("giocatori")
    .select("id,nome,foto_url,tipo,ruolo")
    .eq("attivo", true)
    .order("tipo", { ascending: true })
    .order("nome", { ascending: true });
  availPlayers = new Map((data || []).map(p => [String(p.id), p]));
  sel.replaceChildren();
  sel.add(new Option("-- Sélectionne ton nom --", ""));
  (data || []).forEach(player => {
    const label = player.tipo === "staff" ? `${player.nome} - Staff` : player.nome;
    const option = new Option(label, String(player.id));
    option.dataset.name = player.nome;
    sel.add(option);
  });
  sel.add(new Option("⊕ Je ne suis pas dans la liste", "__autre__"));
}

function resetAvailIdentity(clearSelection = false) {
  availIdentityConfirmed = false;
  document.getElementById("avail-identity-check").classList.add("section-hidden");
  document.getElementById("avail-phone-check").classList.add("section-hidden");
  document.getElementById("avail-manual-fields").classList.add("section-hidden");
  document.getElementById("avail-response-actions").classList.add("section-hidden");
  document.getElementById("avail-phone-input").value = '';
  document.getElementById("avail-guest-phone").value = '';
  if (clearSelection) document.getElementById("avail-player-select").value = '';
}

function updateDeadlineBox() {
  const match = getSelectedMatch();
  const box = document.getElementById("availability-deadline");
  const title = document.getElementById("deadline-title");
  const text = document.getElementById("deadline-text");

  availabilityOpen = isAvailabilityOpen(match);
  box.classList.toggle("deadline-closed", !availabilityOpen);
  box.classList.toggle("deadline-open", availabilityOpen);

  if (!match) {
    title.textContent = "Choisis un match";
    text.textContent = "";
  } else if (!availabilityOpen) {
    title.textContent = "Réponses fermées";
    text.textContent = match.scadenza_disponibilita
      ? `La limite était ${fmtDeadline(match.scadenza_disponibilita)}.`
      : "Le match est déjà passé.";
  } else if (match.scadenza_disponibilita) {
    title.textContent = "Réponds avant";
    text.textContent = fmtDeadline(match.scadenza_disponibilita);
  } else {
    title.textContent = "Réponses ouvertes";
    text.textContent = "Aucune heure limite indiquée.";
  }

  if (!availabilityOpen) resetAvailIdentity();
}

// Mostra i campi manuali solo se l'utente sceglie "Je ne suis pas dans la liste"
window.onAvailPlayerChange = function () {
  const select = document.getElementById("avail-player-select");
  const val = select.value;
  resetAvailIdentity();

  if (!availabilityOpen || !val) return;

  if (val === "__autre__") {
    document.getElementById("avail-manual-fields").classList.remove("section-hidden");
    document.getElementById("avail-response-actions").classList.remove("section-hidden");
    return;
  }

  const player = availPlayers.get(val);
  const playerName = player?.nome ||
    select.options[select.selectedIndex].dataset.name ||
    select.options[select.selectedIndex].textContent;
  const photo = document.getElementById("avail-identity-photo");
  const avatar = document.getElementById("avail-identity-avatar");

  document.getElementById("avail-identity-name").textContent = playerName;
  photo.alt = playerName;
  photo.onerror = () => {
    photo.classList.add("section-hidden");
    avatar.textContent = playerName.split(/\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase();
    avatar.classList.remove("section-hidden");
  };
  if (player?.foto_url) {
    photo.src = player.foto_url;
    photo.classList.remove("section-hidden");
    avatar.classList.add("section-hidden");
  } else {
    photo.src = "logo.png";
    photo.classList.add("section-hidden");
    avatar.textContent = playerName.split(/\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase();
    avatar.classList.remove("section-hidden");
  }
  document.getElementById("avail-identity-check").classList.remove("section-hidden");
};

window.confirmAvailIdentity = function (confirmed) {
  if (!confirmed) {
    resetAvailIdentity(true);
    return;
  }

  availIdentityConfirmed = true;
  document.getElementById("avail-identity-check").classList.add("section-hidden");
  document.getElementById("avail-phone-check").classList.remove("section-hidden");
  document.getElementById("avail-response-actions").classList.remove("section-hidden");
  document.getElementById("avail-phone-input").focus();
};

window.loadAvail = async function () {
  const id = document.getElementById("match-select").value;
  const el = document.getElementById("avail-list");
  resetAvailIdentity(true);
  updateDeadlineBox();
  if (!id) { el.innerHTML = '<div class="empty-msg">Sélectionne un match.</div>'; return; }
  const { data } = await supabase.from("disponibilita").select("*").eq("match_id", id).order("nome");
  if (!data || !data.length) { el.innerHTML = '<div class="empty-msg">Aucune réponse pour ce match.</div>'; return; }
  const si = data.filter(a => a.disponibile), no = data.filter(a => !a.disponibile);
  el.replaceChildren();

  const appendGroup = (responses, available) => {
    if (!responses.length) return;

    const divider = document.createElement("div");
    divider.className = "divider-label";
    if (!available) divider.style.marginTop = "10px";
    divider.textContent = `${available ? "✅ Disponibles" : "❌ Pas disponibles"} (${responses.length})`;
    el.appendChild(divider);

    responses.forEach(response => {
      const row = document.createElement("div");
      row.className = "avail-item";

      const name = document.createElement("div");
      name.style.flex = "1";
      name.textContent = response.nome;

      const badge = document.createElement("span");
      badge.className = `badge ${available ? "badge-win" : "badge-loss"}`;
      badge.textContent = available ? "Oui" : "Non";

      row.append(name, badge);
      el.appendChild(row);
    });
  };

  appendGroup(si, true);
  appendGroup(no, false);
};

window.submitAvail = async function (ok) {
  const id = document.getElementById("match-select").value;
  if (!id || !availabilityOpen) {
    showAvailError(!availabilityOpen ? "Les réponses sont fermées." : "Sélectionne un match.");
    return;
  }

  const selected = document.getElementById("avail-player-select").value;
  let error;

  if (selected && selected !== "__autre__") {
    const phone = document.getElementById("avail-phone-input").value.trim();
    if (!availIdentityConfirmed) {
      showAvailError("Confirme d'abord que c'est bien toi.");
      return;
    }

    ({ error } = await supabase.rpc("registra_disponibilita_giocatore", {
      p_match_id: parseInt(id),
      p_giocatore_id: parseInt(selected),
      p_telefono: phone || null,
      p_disponibile: ok
    }));
  } else {
    const nome = (document.getElementById("avail-nome").value || '').trim();
    const cognome = (document.getElementById("avail-cognome").value || '').trim();
    if (!nome || !cognome) {
      showAvailError("Écris ton prénom et ton nom.");
      return;
    }

    const phone = (document.getElementById("avail-guest-phone").value || '').trim();
    ({ error } = await supabase.rpc("registra_disponibilita_ospite", {
      p_match_id: parseInt(id),
      p_nome: nome,
      p_cognome: cognome,
      p_telefono: phone || null,
      p_disponibile: ok
    }));
  }

  if (error) {
    console.error(error);
    const messages = {
      RACCOLTA_CHIUSA: "Les réponses sont fermées.",
      TELEFONO_MANCANTE: "Ton téléphone n'est pas encore enregistré. Écris-le dans le champ téléphone.",
      TELEFONO_NON_VALIDO: "Écris un téléphone complet avec le code du pays.",
      NOME_GIA_PRESENTE: "Ton nom est dans la liste. Sélectionne-le.",
      NOME_NON_VALIDO: "Écris ton prénom et ton nom."
    };
    const known = Object.keys(messages).find(code => error.message?.includes(code));
    showAvailError(known ? messages[known] : "Impossible d'enregistrer. Réessaie.");
    return;
  }

  document.getElementById("avail-nome").value = '';
  document.getElementById("avail-cognome").value = '';
  document.getElementById("avail-guest-phone").value = '';
  resetAvailIdentity(true);
  showMsg('avail-success');
  loadAvail();
};

function showAvailError(message) {
  const el = document.getElementById("avail-err");
  el.textContent = message;
  showMsg('avail-err');
}

// ---- STATISTICHE con foto e presenze ----
let currentStatType = 'presenze';
let statPlayers = [];
let statPlayedMatches = [];
let statMapCurrent = {};

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

  const { data: players, error: pe } = await supabase.from("giocatori").select("*").eq("attivo", true).eq("tipo", "giocatore").order("nome");
  const { data: matches, error: me } = await supabase.from("matches").select("id, avversario, data, stato, risultato, orario, campo").order("data");

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
  statPlayers = players || [];
  statPlayedMatches = playedMatches;
  statMapCurrent = statMap;

  const titles = { presenze: 'Présences joueurs', gol: 'Buts & Passes décisives', cartellini: 'Cartons' };
  const icons = { presenze: 'ti-clipboard-check', gol: 'ti-ball-football', cartellini: 'ti-cards' };
  titleEl.innerHTML = `<i class="ti ${icons[currentStatType]}"></i> ${titles[currentStatType]}`;

  const posCol = { G: 'badge-navy', D: 'badge-navy', M: 'badge-gold', A: 'badge-red' };

  function playerCell(p) {
    const safeName = escapeHtml(p.nome);
    const safePhoto = escapeHtml(p.foto_url || '');
    const safePos = escapeHtml(p.posizione || '-');
    const photoUrl = p.foto_url
      ? `<img src="${safePhoto}" class="player-photo" alt="${safeName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
      : '';
    const initials = escapeHtml(p.nome.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 3) || '?');
    return `<button type="button" class="player-cell player-cell-click" onclick="openPlayerStats(${p.id})" aria-label="Voir les statistiques de ${safeName}">
      ${photoUrl}
      <div class="avatar" style="${p.foto_url ? 'display:none' : ''}">${initials}</div>
      <div class="player-info">
        <div class="player-name">${safeName}</div>
        <span class="badge ${posCol[p.posizione] || 'badge-navy'}" style="font-size:10px">${safePos}</span>
      </div>
    </button>`;
  }

  let html = '';

  // ---------- PRESENZE: griglia per partita + % ----------
  if (currentStatType === 'presenze') {
    html = `<div style="overflow-x:auto;"><table class="stat-table-full"><thead><tr><th class="th-player">Joueur</th>`;
    playedMatches.forEach(m => {
      const d = new Date(m.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const safeAvv = escapeHtml(m.avversario || '');
      const shortAvv = escapeHtml((m.avversario || '').split(' ')[0]);
      html += `<th class="th-match" title="${safeAvv}">${d}<br><span style="font-size:10px;font-weight:normal;">${shortAvv}</span></th>`;
    });
    html += `<th class="th-total">Total</th><th class="th-total" style="background:#1a7a1a !important">%</th></tr></thead><tbody>`;

    players.forEach(p => {
      html += `<tr><td class="td-player">${playerCell(p)}</td>`;
      let total = 0;
      playedMatches.forEach(m => {
        const s = statMap[`${p.id}_${m.id}`];
        const presente = s && s.presente;
        if (presente) total++;
        let cell;
        if (presente) {
          cell = s.numero_maglia
            ? `<span class="pres-maglia">${s.numero_maglia}</span>`
            : '<span class="pres-si">✓</span>';
        } else {
          cell = '<span class="pres-no">✗</span>';
        }
        html += `<td class="td-pres">${cell}</td>`;
      });
      const pct = Math.round(total / playedMatches.length * 100);
      html += `<td class="td-total">${total}</td><td class="td-total" style="background:#eaf3de;color:#27500a">${pct}%</td></tr>`;
    });
    html += '</tbody></table></div>';
    html += '<div style="font-size:11px;color:#888;margin-top:8px;">Le numéro indique le maillot porté ce match-là · ✓ présent sans numéro · ✗ absent</div>';

    // Staff con presenze
    const { data: staff } = await supabase.from("giocatori").select("*").eq("attivo", true).eq("tipo", "staff").order("ruolo");
    if (staff && staff.length) {
      html += '<div style="margin-top:18px;"><div class="card-title" style="margin-bottom:10px;"><i class="ti ti-briefcase"></i> Staff — présences</div>';
      staff.forEach(p => {
        const initials = p.nome.split(' ').map(x => x[0]).join('').toUpperCase();
        let total = 0;
        playedMatches.forEach(m => {
          const s = statMap[`${p.id}_${m.id}`];
          if (s && s.presente) total++;
        });
        const pct = playedMatches.length ? Math.round(total / playedMatches.length * 100) : 0;
        html += `<div class="avail-item">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            ${p.foto_url
              ? `<img src="${p.foto_url}" class="player-photo-sm" onerror="this.style.display='none'">`
              : `<div class="avatar" style="background:#633806">${initials}</div>`}
            <div>
              <div style="font-weight:500">${p.nome}</div>
              <span class="badge badge-gold" style="font-size:10px">${p.ruolo || 'Staff'}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;color:#888;">${total}/${playedMatches.length}</span>
            <span class="badge" style="background:#eaf3de;color:#27500a;">${pct}%</span>
          </div>
        </div>`;
      });
      html += '</div>';
    }
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

function playerStatTotals(playerId) {
  return statPlayedMatches.reduce((totals, match) => {
    const s = statMapCurrent[`${playerId}_${match.id}`];
    if (s?.presente) totals.presenze += 1;
    if (!s?.presente) totals.assenze += 1;
    totals.gol += s?.gol || 0;
    totals.assist += s?.assist || 0;
    totals.gialli += s?.gialli || 0;
    totals.rossi += s?.rossi || 0;
    return totals;
  }, { presenze: 0, assenze: 0, gol: 0, assist: 0, gialli: 0, rossi: 0 });
}

function playerAvatarHtml(player, sizeClass = '') {
  const safeName = escapeHtml(player.nome || '');
  const initials = escapeHtml((player.nome || '?').split(' ').filter(Boolean).map(x => x[0]).join('').toUpperCase().slice(0, 3) || '?');
  if (player.foto_url) {
    return `<img src="${escapeHtml(player.foto_url)}" class="player-stats-photo ${sizeClass}" alt="${safeName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <div class="player-stats-avatar ${sizeClass}" style="display:none">${initials}</div>`;
  }
  return `<div class="player-stats-avatar ${sizeClass}">${initials}</div>`;
}

function playerMatchDetailHtml(playerId) {
  if (!statPlayedMatches.length) {
    return '<div class="empty-msg">Aucune partita jouee.</div>';
  }

  return statPlayedMatches.map(match => {
    const s = statMapCurrent[`${playerId}_${match.id}`];
    const presente = !!s?.presente;
    const date = new Date(match.data + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const extras = [];
    if (presente && s?.numero_maglia) extras.push(`Maillot ${escapeHtml(s.numero_maglia)}`);
    if (s?.gol) extras.push(`${s.gol} but${s.gol > 1 ? 's' : ''}`);
    if (s?.assist) extras.push(`${s.assist} passe${s.assist > 1 ? 's' : ''}`);
    if (s?.gialli) extras.push(`${s.gialli} jaune${s.gialli > 1 ? 's' : ''}`);
    if (s?.rossi) extras.push(`${s.rossi} rouge${s.rossi > 1 ? 's' : ''}`);
    const matchInfo = [
      match.orario || '',
      match.campo || '',
      match.risultato || ''
    ].filter(Boolean).map(escapeHtml).join(' · ');

    return `<div class="player-match-row ${presente ? 'present' : 'absent'}">
      <div class="player-match-date">${date}</div>
      <div>
        <div class="player-match-title">${escapeHtml(match.avversario)}</div>
        <div class="player-match-detail">${matchInfo || 'Match joue'}${extras.length ? ' · ' + extras.join(' · ') : ''}</div>
      </div>
      <span class="badge player-match-state ${presente ? 'badge-win' : 'badge-loss'}">${presente ? 'Present' : 'Absent'}</span>
    </div>`;
  }).join('');
}

window.openPlayerStats = function (playerId) {
  const player = statPlayers.find(p => p.id === playerId);
  if (!player) return;

  const totals = playerStatTotals(playerId);
  const pct = statPlayedMatches.length ? Math.round((totals.presenze / statPlayedMatches.length) * 100) : 0;
  const safeName = escapeHtml(player.nome);
  const safePos = escapeHtml(player.posizione || '-');
  const posCol = { G: 'badge-navy', D: 'badge-navy', M: 'badge-gold', A: 'badge-red' };

  document.getElementById("player-stats-content").innerHTML = `
    <div class="player-stats-head">
      ${playerAvatarHtml(player)}
      <div>
        <div class="player-stats-name">${safeName}</div>
        <span class="badge ${posCol[player.posizione] || 'badge-navy'}">${safePos}</span>
      </div>
    </div>
    <div class="player-stats-metrics">
      <div class="player-stats-metric"><strong>${totals.presenze}</strong><span>Presences</span></div>
      <div class="player-stats-metric"><strong>${pct}%</strong><span>Participation</span></div>
      <div class="player-stats-metric"><strong>${totals.gol}</strong><span>Buts</span></div>
      <div class="player-stats-metric"><strong>${totals.assist}</strong><span>Passes</span></div>
      <div class="player-stats-metric"><strong>${totals.gialli}</strong><span>Jaunes</span></div>
      <div class="player-stats-metric"><strong>${totals.rossi}</strong><span>Rouges</span></div>
      <div class="player-stats-metric"><strong>${totals.assenze}</strong><span>Absences</span></div>
      <div class="player-stats-metric"><strong>${statPlayedMatches.length}</strong><span>Matches</span></div>
    </div>
    <div class="card-title" style="margin-top:18px;margin-bottom:6px;"><i class="ti ti-list-check"></i> Participation par match</div>
    <div class="player-match-list">${playerMatchDetailHtml(playerId)}</div>
  `;

  document.getElementById("player-stats-viewer").classList.remove("section-hidden");
  document.body.classList.add("modal-open");
};

window.closePlayerStats = function () {
  document.getElementById("player-stats-viewer").classList.add("section-hidden");
  document.getElementById("player-stats-content").innerHTML = '';
  document.body.classList.remove("modal-open");
};

window.stopPlayerStatsClick = function (event) {
  event.stopPropagation();
};

// ---- GALLERIA ----
async function loadGalleria() {
  const el = document.getElementById("galleria-content");
  const { data: matches } = await supabase.from("matches").select("id, avversario, data").order("data", { ascending: false });
  const { data: foto } = await supabase.from("foto").select("*").order("created_at", { ascending: false });
  galleryPhotos = [];

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
    const safeLabel = escapeHtml(label);
    html += `<div class="card">
      <div class="card-title"><i class="ti ti-photo"></i> ${safeLabel}</div>
      <div class="photo-grid">`;
    byMatch[mid].forEach(f => {
      const caption = f.didascalia || label;
      const photoIndex = galleryPhotos.push({ url: f.url, caption, label }) - 1;
      const safeUrl = escapeHtml(f.url);
      const safeAlt = escapeHtml(caption);
      html += `<button type="button" class="photo-thumb" onclick="openGalleryPhoto(${photoIndex})" aria-label="Voir la photo en grand">
        <img src="${safeUrl}" alt="${safeAlt}" loading="lazy" onerror="this.classList.add('section-hidden');this.nextElementSibling.classList.remove('section-hidden');">
        <i class="ti ti-photo photo-fallback section-hidden"></i>
        <span class="photo-thumb-action"><i class="ti ti-zoom-in"></i></span>
      </button>`;
    });
    html += `</div></div>`;
  });
  el.innerHTML = html;
}

function applyGalleryZoom() {
  const img = document.getElementById("photo-viewer-img");
  if (!img) return;
  img.style.transform = `scale(${currentGalleryZoom})`;
}

function galleryDownloadName(photo) {
  const base = (photo?.label || 'as-bologne-photo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'as-bologne-photo';
  let ext = 'jpg';
  try {
    const path = new URL(photo.url).pathname;
    ext = (path.split('.').pop() || 'jpg').split(/[?#]/)[0].slice(0, 5) || 'jpg';
  } catch (error) {
    ext = 'jpg';
  }
  return `${base}-${Date.now()}.${ext}`;
}

window.openGalleryPhoto = function (index) {
  const photo = galleryPhotos[index];
  if (!photo) return;
  currentGalleryPhotoIndex = index;
  currentGalleryZoom = 1;
  const viewer = document.getElementById("photo-viewer");
  const img = document.getElementById("photo-viewer-img");
  const caption = document.getElementById("photo-viewer-caption");
  img.src = photo.url;
  img.alt = photo.caption || photo.label || 'Photo A.S. Bologne';
  caption.textContent = photo.caption || photo.label || '';
  applyGalleryZoom();
  viewer.classList.remove("section-hidden");
  document.body.classList.add("modal-open");
};

window.closeGalleryPhoto = function () {
  const viewer = document.getElementById("photo-viewer");
  const img = document.getElementById("photo-viewer-img");
  viewer.classList.add("section-hidden");
  document.body.classList.remove("modal-open");
  currentGalleryPhotoIndex = null;
  currentGalleryZoom = 1;
  img.src = '';
};

window.zoomGalleryPhoto = function (delta) {
  currentGalleryZoom = Math.min(3, Math.max(0.5, currentGalleryZoom + delta));
  applyGalleryZoom();
};

window.resetGalleryZoom = function () {
  currentGalleryZoom = 1;
  applyGalleryZoom();
};

window.stopPhotoViewerClick = function (event) {
  event.stopPropagation();
};

window.downloadGalleryPhoto = async function () {
  const photo = galleryPhotos[currentGalleryPhotoIndex];
  if (!photo?.url) return;

  try {
    const response = await fetch(photo.url, { mode: 'cors' });
    if (!response.ok) throw new Error('download failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = galleryDownloadName(photo);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    window.open(photo.url, "_blank", "noopener");
  }
};

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
