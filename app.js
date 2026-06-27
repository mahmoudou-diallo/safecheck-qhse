/* ══ SafeCheck QHSE v5 — App Logic ══ */

const STORE = {
  user: '',
  incidents: [],
  checklists: [],
  quizScores: [],
  page: 'dashboard'
};

function init() {
  loadStore();
  const name = localStorage.getItem('sc_name');
  if (name) {
    STORE.user = name;
    boot();
  }
  document.getElementById('splashGo').onclick = () => {
    const n = document.getElementById('splashName').value.trim();
    if (n) { STORE.user = n; localStorage.setItem('sc_name', n); boot(); }
  };
  document.getElementById('splashName').onkeydown = e => { if (e.key === 'Enter') document.getElementById('splashGo').click(); };
  document.getElementById('incForm').onsubmit = e => { e.preventDefault(); addIncident(); };
}

function loadStore() {
  try {
    const d = localStorage.getItem('sc_data');
    if (d) Object.assign(STORE, JSON.parse(d));
  } catch(e) {}
}

function saveStore() {
  localStorage.setItem('sc_data', JSON.stringify({
    incidents: STORE.incidents,
    checklists: STORE.checklists,
    quizScores: STORE.quizScores
  }));
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 2200);
}

function boot() {
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('layout').classList.remove('hidden');
  document.getElementById('sbName').textContent = STORE.user;
  document.getElementById('welcomeUser').textContent = STORE.user;
  document.getElementById('sbAvatar').textContent = STORE.user.charAt(0).toUpperCase();
  go('dashboard');
  setTimeout(animIn, 150);
}

function animIn() {
  try {
    gsap.from('.kpi', { opacity: 0, y: 16, stagger: 0.06, duration: 0.35, ease: 'power2.out', clearProps: 'all' });
    gsap.from('.chart-box', { opacity: 0, y: 16, stagger: 0.08, duration: 0.35, delay: 0.12, ease: 'power2.out', clearProps: 'all' });
  } catch(e) {}
}

function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

function go(page) {
  STORE.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('p-' + page);
  if (el) el.classList.add('active');
  const btn = document.querySelector('.nb[data-p="' + page + '"]');
  if (btn) btn.classList.add('active');
  const titles = { dashboard: 'Dashboard', incidents: 'Incidents', checklist: 'Checklist', training: 'Formation', reports: 'Rapports' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  if (page === 'dashboard') refreshDash();
  if (page === 'incidents') renderIncidents();
  if (page === 'checklist') renderChecklist();
  if (page === 'training') refreshTraining();
}

function editName() {
  const n = prompt('Votre nom :', STORE.user);
  if (n && n.trim()) {
    STORE.user = n.trim();
    localStorage.setItem('sc_name', n.trim());
    document.getElementById('sbName').textContent = n.trim();
    document.getElementById('welcomeUser').textContent = n.trim();
    document.getElementById('sbAvatar').textContent = n.trim().charAt(0).toUpperCase();
  }
}

/* ══ DASHBOARD ══ */
function refreshDash() {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  const monthInc = STORE.incidents.filter(i => { const d = new Date(i.date); return d.getMonth() === m && d.getFullYear() === y; });
  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;
  const prevInc = STORE.incidents.filter(i => { const d = new Date(i.date); return d.getMonth() === prevM && d.getFullYear() === prevY; });

  document.getElementById('dashIncidents').textContent = monthInc.length;
  document.getElementById('dashInspections').textContent = STORE.checklists.filter(c => c.completed).length;

  const totalItems = STORE.checklists.reduce((s, c) => s + (c.items ? c.items.length : 0), 0);
  const passItems = STORE.checklists.reduce((s, c) => s + (c.items ? c.items.filter(it => it.status === 'passed').length : 0), 0);
  const comp = totalItems > 0 ? Math.round((passItems / totalItems) * 100) : 0;
  document.getElementById('dashCompliance').textContent = comp + '%';

  document.getElementById('dashBadges').textContent = STORE.quizScores.filter(s => s.badge).length;

  // Trends
  trend('dashIncTr', monthInc.length, prevInc.length);
  trend('dashInspTr', STORE.checklists.filter(c => c.completed).length, 1);
  trend('dashCompTr', comp, 50);
  trend('dashBadgeTr', STORE.quizScores.filter(s => s.badge).length, 0);

  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('tbDate').textContent = now.toLocaleDateString('fr-FR', opts);
  document.getElementById('tbIncidents').textContent = monthInc.length + ' incident' + (monthInc.length > 1 ? 's' : '');

  // Recent
  const recent = STORE.incidents.slice(-5).reverse();
  const rc = document.getElementById('recentList');
  if (!recent.length) { rc.innerHTML = '<div class="empty">Aucune activité ce mois</div>'; }
  else {
    rc.innerHTML = recent.map(i => `<div class="inc-item" onclick="go('incidents')">
      <div class="inc-item-hdr"><span class="inc-bdg ${badgeCls(i.gravity)}">${esc(i.type)}</span><span class="inc-loc">${esc(i.location)}</span><span class="inc-date">${i.date}</span></div>
      <div class="inc-desc">${esc(i.description)}</div>
    </div>`).join('');
  }

  drawTypeChart(monthInc);
  drawTrend();
}

function trend(id, cur, prev) {
  const el = document.getElementById(id);
  if (prev === 0 && cur === 0) { el.textContent = '—'; return; }
  if (prev === 0) { el.textContent = 'Nouveau'; el.style.color = 'var(--green)'; return; }
  const d = ((cur - prev) / prev) * 100;
  el.textContent = (d >= 0 ? '+' : '') + d.toFixed(0) + '%';
  el.style.color = d >= 0 ? 'var(--red)' : 'var(--green)';
}

function badgeCls(g) { const n = parseInt(g); if (n >= 4) return 'danger'; if (n === 3) return 'warning'; if (n <= 1) return 'success'; return 'info'; }

/* ══ CHARTS ══ */
function setupCanvas(id) {
  const c = document.getElementById(id); if (!c) return null;
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = c.parentElement.getBoundingClientRect();
  c.width = rect.width * dpr; c.height = 200 * dpr;
  c.style.width = rect.width + 'px'; c.style.height = '200px';
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: 200 };
}

function drawTypeChart(incidents) {
  const s = setupCanvas('chartTypes'); if (!s) return;
  const { ctx, w, h } = s;
  const types = ['Accident', 'Incident', 'Presque accident', 'Non-conformité', 'Environnement', 'Equipement'];
  const vals = types.map(t => incidents.filter(i => i.type === t).length);
  const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899'];
  const max = Math.max(...vals, 1);
  const pad = 40, bw = w - 80, bh = 150, by = 15;
  const gap = bw / types.length;
  const barW = Math.min(gap * 0.55, 36);
  const off = (gap - barW) / 2;

  ctx.clearRect(0, 0, w, h);
  vals.forEach((v, i) => {
    const x = pad + i * gap + off;
    const ch = (v / max) * bh;
    const y = by + bh - ch;
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, Math.max(ch, 2), [4, 4, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.font = '500 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(types[i].charAt(0), x + barW / 2, by + bh + 14);
    ctx.fillText(v, x + barW / 2, y - 5);
  });
}

function drawTrend() {
  const s = setupCanvas('chartTrend'); if (!s) return;
  const { ctx, w, h } = s;
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('fr-FR', { month: 'short' }),
      count: STORE.incidents.filter(inc => {
        const id = new Date(inc.date);
        return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
      }).length
    });
  }
  const pad = { t: 15, r: 15, b: 25, l: 35 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const max = Math.max(...months.map(m => m.count), 3);

  ctx.clearRect(0, 0, w, h);
  // Grid
  ctx.strokeStyle = '#F1F5F9'; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = pad.t + (ch / 3) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#94A3B8'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max / 3) * i), pad.l - 6, y + 3);
  }
  // Line
  const step = cw / (months.length - 1);
  ctx.beginPath();
  months.forEach((m, i) => {
    const x = pad.l + i * step, y = pad.t + ch - (m.count / max) * ch;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#F97316'; ctx.lineWidth = 2.5; ctx.stroke();
  // Fill
  ctx.lineTo(pad.l + (months.length - 1) * step, pad.t + ch);
  ctx.lineTo(pad.l, pad.t + ch); ctx.closePath();
  ctx.fillStyle = 'rgba(249,115,22,0.08)'; ctx.fill();
  // Points
  months.forEach((m, i) => {
    const x = pad.l + i * step, y = pad.t + ch - (m.count / max) * ch;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#F97316'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = '#64748B'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.label, x, pad.t + ch + 16);
  });
}

/* ══ INCIDENTS ══ */
function addIncident() {
  const data = {
    id: Date.now().toString(36),
    type: document.getElementById('fType').value,
    date: document.getElementById('fDate').value,
    gravity: document.getElementById('fGrav').value,
    location: document.getElementById('fLoc').value.trim(),
    description: document.getElementById('fDesc').value.trim(),
    action: document.getElementById('fAction').value.trim(),
    reporter: STORE.user,
    created: new Date().toISOString()
  };
  if (!data.type || !data.date || !data.location || !data.description) {
    toast('Tous les champs obligatoires doivent être remplis', 'error'); return;
  }
  STORE.incidents.push(data);
  saveStore();
  document.getElementById('incForm').reset();
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
  renderIncidents();
  refreshDash();
  toast('Incident enregistré', 'success');
  setTimeout(() => go('dashboard'), 800);
}

function renderIncidents() {
  const list = document.getElementById('incList');
  const items = STORE.incidents.slice().reverse();
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
  if (!items.length) { list.innerHTML = '<div class="empty">Aucun incident enregistré</div>'; return; }
  list.innerHTML = items.map(i => `<div class="inc-item">
    <div class="inc-item-hdr"><span class="inc-bdg ${badgeCls(i.gravity)}">${esc(i.type)}</span><span class="inc-loc">${esc(i.location)}</span><span class="inc-date">${i.date} · G${i.gravity}</span></div>
    <div class="inc-desc">${esc(i.description)}</div>
  </div>`).join('');
}

/* ══ CHECKLIST ══ */
const CL_ITEMS = [
  { cat: 'EPI', items: ['Casque de sécurité porté', 'Lunettes de protection dispo', 'Gants adaptés à la tâche', 'Chaussures de sécurité', 'Protection auditive'] },
  { cat: 'Zone de travail', items: ['Sols propres et dégagés', 'Éclairage suffisant', 'Extincteurs accessibles', 'Issues de secours dégagées', 'Stockage conforme'] },
  { cat: 'Équipements', items: ['Équipements en bon état', 'Dispositifs sécurité OK', 'Câbles en bon état', 'Maintenance à jour', 'Protections en place'] },
  { cat: 'Procédures', items: ['Procédures disponibles', 'Permis de travail OK', 'Registre à jour', 'FDS accessibles', 'Consignes d\'urgence affichées'] }
];

let _cl = null;

function renderChecklist() {
  _cl = STORE.checklists.find(c => !c.completed);
  if (!_cl) newChecklist();
  else buildCL();
}

function newChecklist() {
  if (_cl && !_cl.completed && !confirm('Archiver l\'inspection en cours ?')) return;
  _cl = {
    id: Date.now().toString(36),
    date: new Date().toISOString().split('T')[0],
    inspector: STORE.user,
    completed: false,
    items: []
  };
  CL_ITEMS.forEach(cat => cat.items.forEach(item => {
    _cl.items.push({ category: cat.cat, text: item, status: 'pending' });
  }));
  STORE.checklists.push(_cl);
  saveStore();
  buildCL();
  toast('Nouvelle inspection créée', 'info');
}

function buildCL() {
  if (!_cl) return;
  document.getElementById('clGrid').innerHTML = _cl.items.map((item, idx) => `
    <div class="cl-item ${item.status !== 'pending' ? item.status : ''}" onclick="toggleCL(${idx})">
      <div class="cl-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="cl-text"><strong>${esc(item.text)}</strong><span>${item.category}</span></div>
    </div>
  `).join('');
  updateCLMeta();
}

function toggleCL(idx) {
  if (!_cl) return;
  const item = _cl.items[idx];
  if (item.status === 'pending') item.status = 'passed';
  else if (item.status === 'passed') item.status = 'failed';
  else item.status = 'pending';
  saveStore();
  buildCL();
}

function updateCLMeta() {
  if (!_cl) return;
  const total = _cl.items.length;
  const passed = _cl.items.filter(i => i.status === 'passed').length;
  const failed = _cl.items.filter(i => i.status === 'failed').length;
  const done = passed + failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('clPct').textContent = pct + '%';
  document.getElementById('clDone').innerHTML = passed + '<span class="kpi-unit"> / ' + total + '</span>';
  document.getElementById('clTotal').textContent = total;
}

function saveChecklist() {
  if (!_cl) return;
  const sig = document.getElementById('clSign').value.trim();
  if (!sig) { toast('Signez l\'inspection', 'error'); return; }
  const done = _cl.items.filter(i => i.status !== 'pending').length;
  if (!done) { toast('Inspectez au moins un point', 'error'); return; }
  _cl.completed = true;
  _cl.inspector = sig;
  _cl.completedAt = new Date().toISOString();
  saveStore();
  toast('Inspection validée (' + done + '/' + _cl.items.length + ')', 'success');
  _cl = null;
  document.getElementById('clSign').value = '';
  setTimeout(renderChecklist, 100);
}

/* ══ TRAINING ══ */
const QUIZ = [
  { q: 'Que signifie QHSE ?', opts: ['Qualité, Hygiène, Sécurité, Environnement', 'Quantité, Habitat, Service, Entretien', 'Qualité, Habilitation, Système, Evaluation'], ans: 0 },
  { q: 'Principe de prévention : ordre correct ?', opts: ['Éliminer → Substituer → Réduire → Protéger', 'Protéger → Réduire → Substituer → Eliminer', 'Réduire → Eliminer → Protéger → Substituer'], ans: 0 },
  { q: 'Le port des EPI est :', opts: ['Obligatoire si risque non éliminé', 'Recommandé', 'Uniquement pour les nouveaux'], ans: 0 },
  { q: 'Un "presque accident" (near miss) :', opts: ['Événement qui aurait pu causer un accident', 'Accident bénin', 'Simulation d\'accident'], ans: 0 },
  { q: 'La norme ISO 45001 concerne :', opts: ['Santé et sécurité au travail', 'Gestion qualité', 'Management environnemental'], ans: 0 },
  { q: 'Que signifie FDS ?', opts: ['Fiche de Données de Sécurité', 'Fiche de Déclaration Standard', 'Formulaire Demande Sécurité'], ans: 0 },
  { q: 'Analyse des risques doit être faite :', opts: ['Avant toute nouvelle activité', 'Une fois par an', 'Après un accident'], ans: 0 },
  { q: 'Un audit QHSE sert à :', opts: ['Évaluer la conformité', 'Former les employés', 'Remplacer équipements'], ans: 0 },
  { q: 'Hiérarchie prévention priorise :', opts: ['Suppression du risque à la source', 'Port des EPI', 'Signalisation'], ans: 0 },
  { q: 'En cas d\'incident grave :', opts: ['Protéger, alerter, secourir', 'Remplir le rapport', 'Contacter le responsable'], ans: 0 }
];

let _quiz = null;

function startQuiz() {
  const shuffled = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 10);
  _quiz = { questions: shuffled, current: 0, score: 0, answered: false };
  document.getElementById('trainIntro').style.display = 'none';
  document.getElementById('quizWrap').classList.remove('hidden');
  document.getElementById('qzResult').classList.add('hidden');
  showQ();
}

function showQ() {
  const q = _quiz.questions[_quiz.current];
  document.getElementById('qzCount').textContent = (_quiz.current + 1) + '/' + _quiz.questions.length;
  document.getElementById('qzFill').style.width = (_quiz.current / _quiz.questions.length) * 100 + '%';
  document.getElementById('qzQ').textContent = q.q;
  document.getElementById('qzOpts').innerHTML = q.opts.map((o, i) => `<button class="qz-opt" onclick="pickQ(${i})">${esc(o)}</button>`).join('');
  document.getElementById('qzNext').style.display = 'none';
  _quiz.answered = false;
}

function pickQ(idx) {
  if (_quiz.answered) return;
  const q = _quiz.questions[_quiz.current];
  _quiz.answered = true;
  document.querySelectorAll('.qz-opt').forEach((el, i) => {
    el.classList.remove('selected', 'correct', 'wrong');
    el.style.cursor = 'default';
    if (i === q.ans) el.classList.add('correct');
    else if (i === idx) el.classList.add('wrong');
    if (i === idx && idx === q.ans) el.classList.add('selected');
  });
  if (idx === q.ans) _quiz.score++;
  const last = _quiz.current === _quiz.questions.length - 1;
  document.getElementById('qzNext').textContent = last ? 'Résultats' : 'Suivante';
  document.getElementById('qzNext').style.display = 'inline-flex';
}

function qzNext() {
  _quiz.current++;
  if (_quiz.current >= _quiz.questions.length) finishQ();
  else showQ();
}

function finishQ() {
  const pct = Math.round((_quiz.score / _quiz.questions.length) * 100);
  document.getElementById('qzFill').style.width = '100%';
  document.getElementById('qzResult').classList.remove('hidden');
  document.getElementById('qrScore').textContent = _quiz.score + '/' + _quiz.questions.length;
  let msg, badge = null;
  if (pct >= 90) { msg = 'Excellent ! Maîtrise des fondamentaux QHSE.'; badge = 'Expert HSE'; }
  else if (pct >= 70) { msg = 'Bien ! Quelques points à revoir.'; badge = 'Confirmé HSE'; }
  else if (pct >= 50) { msg = 'Correct. Continuez à apprendre.'; badge = 'Initié HSE'; }
  else { msg = 'Continuez à réviser les fondamentaux.'; }
  document.getElementById('qrMsg').textContent = msg;
  const be = document.getElementById('qrBadge');
  if (badge) { be.classList.remove('hidden'); document.getElementById('qrBadgeName').textContent = badge; }
  else be.classList.add('hidden');
  STORE.quizScores.push({ date: new Date().toISOString(), score: _quiz.score, total: _quiz.questions.length, pct, badge, name: STORE.user });
  saveStore();
  refreshTraining();
}

function closeQuiz() {
  document.getElementById('trainIntro').style.display = 'block';
  document.getElementById('quizWrap').classList.add('hidden');
}

function refreshTraining() {
  const scores = STORE.quizScores;
  const best = scores.length ? Math.max(...scores.map(s => s.pct)) : null;
  document.getElementById('tiBest').textContent = best !== null ? best + '%' : '—';
  document.getElementById('tiAttempts').textContent = scores.length;
  const b = scores.filter(s => s.badge).length;
  document.getElementById('tiBadge').textContent = b > 0 ? b + ' badge(s)' : '—';
}

/* ══ EXPORTS ══ */
function getData(type) {
  if (type === 'incidents') return { incidents: STORE.incidents };
  if (type === 'inspections') return { checklists: STORE.checklists };
  if (type === 'training') return { quizScores: STORE.quizScores };
  return { incidents: STORE.incidents, checklists: STORE.checklists, quizScores: STORE.quizScores };
}

function exportJSON(type) {
  const d = getData(type);
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  dl(blob, 'safecheck-' + type + '-' + new Date().toISOString().split('T')[0] + '.json');
  toast('JSON téléchargé', 'success');
}

function exportCSV(type) {
  const d = getData(type);
  let csv = 'Type,Date,Details\n';
  if (d.incidents) d.incidents.forEach(i => { csv += 'Incident,' + i.date + ',"' + i.type + '|' + i.location + '|G' + i.gravity + '|' + (i.description || '').replace(/"/g, '""') + '"\n'; });
  if (d.checklists) d.checklists.forEach(c => { csv += 'Inspection,' + c.date + ',"' + (c.completed ? 'Terminée' : 'En cours') + '|' + (c.inspector || '') + '|' + c.items.filter(x => x.status !== 'pending').length + '/' + c.items.length + '"\n'; });
  if (d.quizScores) d.quizScores.forEach(q => { csv += 'Quiz,' + q.date.split('T')[0] + ',"' + q.score + '/' + q.total + '|' + q.pct + '%|' + (q.badge || '') + '"\n'; });
  const blob = new Blob([csv], { type: 'text/csv' });
  dl(blob, 'safecheck-' + type + '-' + new Date().toISOString().split('T')[0] + '.csv');
  toast('CSV téléchargé', 'success');
}

function dl(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function esc(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

/* ══ BOOT ══ */
document.addEventListener('DOMContentLoaded', init);
