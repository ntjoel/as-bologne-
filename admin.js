import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";
const ADMIN_PASSWORD = "admin123+";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
  applyStoredLogo();
  if (sessionStorage.getItem("asbologne_admin") === "true") showPanel();
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

  const { data: players } = await supabase.from("giocatori").select("*").eq("attivo", true).order("nome");
  const { data: stats } = await supabase.from("statistiche").select("*").eq("match_id", matchId);
  const { data: dispo } = await supabase.from("disponibilita").select("*").eq("match_id", matchId);

  const statMap = {};
  (stats || []).forEach(s => statMap[s.giocatore_id] = s);

  let html = '';

  // Sezione 1: giocatori registrati
  if (!players || !players.length) {
    html += '<div class="card"><div class="empty-msg">Nessun giocatore registrato. Aggiungili dal tab Joueurs.</div></div>';
  } else {
    html += '<div class="card"><div class="card-title"><i class="ti ti-clipboard-check"></i> Présences — cliquez pour modifier</div>';
    // mappa nomi giocatori (per evidenziare chi ha dato disponibilità)
    const dispoMap = {};
    (dispo || []).forEach(d => { dispoMap[d.nome.toLowerCase().trim()] = d.disponibile; });

    players.forEach(p => {
      const s = statMap[p.id];
      const presente = s && s.presente;
      const initials = p.nome.split(' ').map(x => x[0]).join('').toUpperCase();
      // info disponibilità data dal giocatore
      const dispoVal = dispoMap[p.nome.toLowerCase().trim()];
      let dispoTag = '';
      if (dispoVal === true) dispoTag = '<span class="badge badge-win" style="font-size:9px;margin-left:6px">dispo ✓</span>';
      else if (dispoVal === false) dispoTag = '<span class="badge badge-loss" style="font-size:9px;margin-left:6px">pas dispo</span>';

      html += `<div class="pres-row" id="prow-${p.id}">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          ${p.foto_url
            ? `<img src="${p.foto_url}" class="player-photo-sm" onerror="this.style.display='none'">`
            : `<div class="avatar">${initials}</div>`}
          <div>
            <div style="font-size:14px;font-weight:500">${p.nome}${dispoTag}</div>
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
  }

  // Sezione 2: chi ha dato disponibilità ma NON è tra i giocatori registrati
  if (dispo && dispo.length) {
    const playerNames = new Set((players || []).map(p => p.nome.toLowerCase().trim()));
    const orphans = dispo.filter(d => !playerNames.has(d.nome.toLowerCase().trim()));
    if (orphans.length) {
      html += '<div class="card"><div class="card-title"><i class="ti ti-user-question"></i> Ont répondu mais pas encore dans l\'effectif</div>';
      orphans.forEach(d => {
        const initials = d.nome.split(' ').map(x => x[0]).join('').toUpperCase();
        const dispoTag = d.disponibile
          ? '<span class="badge badge-win" style="font-size:10px">Disponible</span>'
          : '<span class="badge badge-loss" style="font-size:10px">Pas dispo</span>';
        html += `<div class="pres-row">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <div class="avatar" style="background:#888">${initials}</div>
            <div>
              <div style="font-size:14px;font-weight:500">${d.nome}</div>
              ${dispoTag}
            </div>
          </div>
          <button class="pres-btn" style="background:#1a2a5e;color:white;border-color:transparent;font-weight:bold;"
            onclick="quickAddPlayer('${d.nome.replace(/'/g, "\\'")}')">
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
window.quickAddPlayer = async function (nome) {
  const { error } = await supabase.from("giocatori").insert({ nome, posizione: 'M', attivo: true });
  if (error) { console.error(error); alert("Erreur: " + error.message); return; }
  await loadPresenze();
  await loadPlayerList();
  const { count } = await supabase.from("giocatori").select("*", { count: "exact", head: true });
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
};

// ---- GIOCATORI ----
async function loadPlayerList() {
  const { data } = await supabase.from("giocatori").select("*").eq("attivo", true).order("nome");
  const el = document.getElementById("player-list");
  if (!data || !data.length) { el.innerHTML = '<div class="empty-msg">Nessun giocatore ancora.</div>'; return; }
  el.innerHTML = data.map(p => {
    const initials = p.nome.split(' ').map(x => x[0]).join('').toUpperCase();
    const safeName = p.nome.replace(/'/g, "\\'");
    return `<div class="pres-row" id="player-row-${p.id}">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${p.foto_url
          ? `<img src="${p.foto_url}" class="player-photo-sm" onerror="this.style.display='none'">`
          : `<div class="avatar">${initials}</div>`}
        <div>
          <div style="font-size:14px;font-weight:500">${p.nome}</div>
          <span class="badge badge-navy" style="font-size:10px">${p.posizione}${p.numero ? ' · #' + p.numero : ''}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="icon-btn" onclick="editPlayer(${p.id})" title="Modifier"><i class="ti ti-pencil"></i></button>
        <button class="icon-btn icon-btn-del" onclick="deletePlayer(${p.id},'${safeName}')" title="Supprimer"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

// Mostra il form di modifica inline per un giocatore
window.editPlayer = async function (id) {
  const { data: p } = await supabase.from("giocatori").select("*").eq("id", id).single();
  if (!p) return;
  const row = document.getElementById(`player-row-${id}`);
  if (!row) return;
  row.innerHTML = `<div style="width:100%">
    <div class="form-row"><label class="form-lbl">Nom complet</label><input type="text" id="edit-nome-${id}" value="${p.nome.replace(/"/g, '&quot;')}"></div>
    <div class="form-grid">
      <div class="form-row">
        <label class="form-lbl">Poste</label>
        <select id="edit-pos-${id}">
          <option value="G" ${p.posizione === 'G' ? 'selected' : ''}>Gardien (G)</option>
          <option value="D" ${p.posizione === 'D' ? 'selected' : ''}>Défenseur (D)</option>
          <option value="M" ${p.posizione === 'M' ? 'selected' : ''}>Milieu (M)</option>
          <option value="A" ${p.posizione === 'A' ? 'selected' : ''}>Attaquant (A)</option>
        </select>
      </div>
      <div class="form-row"><label class="form-lbl">Numéro</label><input type="number" id="edit-num-${id}" value="${p.numero || ''}" min="1" max="99"></div>
    </div>
    <div class="form-row"><label class="form-lbl">Changer la photo (optionnel)</label><input type="file" id="edit-photo-${id}" accept="image/*"></div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn-primary" style="flex:1" onclick="savePlayer(${id})"><i class="ti ti-device-floppy"></i> Enregistrer</button>
      <button class="btn-outline" onclick="loadPlayerList()"><i class="ti ti-x"></i> Annuler</button>
    </div>
  </div>`;
};

// Salva le modifiche del giocatore
window.savePlayer = async function (id) {
  const nome = document.getElementById(`edit-nome-${id}`).value.trim();
  const pos = document.getElementById(`edit-pos-${id}`).value;
  const num = document.getElementById(`edit-num-${id}`).value;
  const photoFile = document.getElementById(`edit-photo-${id}`).files[0];
  if (!nome) { alert("Le nom est requis"); return; }

  const updates = { nome, posizione: pos, numero: num ? parseInt(num) : null };

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
  await loadPlayerList();
};

// Elimina un giocatore (soft delete: attivo = false)
window.deletePlayer = async function (id, nome) {
  if (!confirm(`Supprimer ${nome} de l'effectif ?`)) return;
  const { error } = await supabase.from("giocatori").update({ attivo: false }).eq("id", id);
  if (error) { alert("Erreur: " + error.message); return; }
  await loadPlayerList();
  const { count } = await supabase.from("giocatori").select("*", { count: "exact", head: true }).eq("attivo", true);
  document.getElementById("adm-giocatori").textContent = count || 0;
};

window.addPlayer = async function () {
  const nome = document.getElementById("new-player-nome").value.trim();
  const pos = document.getElementById("new-player-pos").value;
  const num = document.getElementById("new-player-num").value;
  const photoFile = document.getElementById("new-player-photo").files[0];
  const errEl = document.getElementById("player-err");
  if (!nome) {
    errEl.textContent = "Le nom est requis";
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
        // La foto puo' essere aggiunta dopo - non blocchiamo l'inserimento
      } else {
        foto_url = supabase.storage.from('foto').getPublicUrl(path).data.publicUrl;
      }
    } catch (e) {
      console.warn("Errore foto, continuo senza:", e);
    }
  }

  // Inserisci il giocatore (con o senza foto)
  const { error } = await supabase.from("giocatori").insert({
    nome, posizione: pos, numero: num ? parseInt(num) : null, attivo: true, foto_url
  });
  if (error) {
    console.error("Errore inserimento giocatore:", error);
    errEl.textContent = "Erreur: " + error.message;
    showMsg('player-err');
    return;
  }
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
