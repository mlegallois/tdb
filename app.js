// app.js - Shared logic for dashboard and calendar
const STORAGE_KEY = 'totowood-data-v1';
let state = { data: [] };

const burger = document.getElementById('burger');
const navLinks = document.getElementById('nav-links');

burger.addEventListener('click', () => {
  navLinks.classList.toggle('hidden');
});


// Utils
function nowISODate(){ return new Date().toISOString().slice(0,10); }
function cryptoRandomId(){ return 'id-' + Math.random().toString(36).slice(2,9); }

function loadDataFromStorage(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try { state.data = JSON.parse(raw); return; } catch(e){}
  }
  saveDataToStorage();
}

function saveDataToStorage(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data, null, 2));
}

// compute reminder date
function computeReminderDate(item){
  const d = new Date(item.receivedDate);
  d.setDate(d.getDate() + Number(item.reminderDays || 0));
  return d.toISOString().slice(0,10);
}

function computeDueStatus(item){
  const dueStr = computeReminderDate(item);
  const due = new Date(dueStr);
  const today = new Date(); today.setHours(0,0,0,0);
  due.setHours(0,0,0,0);
  const diff = (due - today)/(1000*60*60*24);
  if(item.status === 'done') return 'done';
  if(diff < 0) return 'overdue';
  if(diff <= 2) return 'due-soon';
  if(diff <= 14) return 'ok';
  return 'future';
}

// UI Helpers
function showToast(msg, t=2500){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(()=> el.classList.add('hidden'), t);
}

// Modal
function openModalWith(item=null){
  const modal = document.getElementById('modal');
  if(!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('modal-title').textContent = item ? 'Modifier demande' : 'Nouvelle demande';
  document.getElementById('request-id').value = item ? item.id : '';
  document.getElementById('receivedDate').value = item ? item.receivedDate : nowISODate();
  document.getElementById('clientName').value = item ? item.clientName : '';
  document.getElementById('summary').value = item ? item.summary : '';
  document.getElementById('status').value = item ? item.status : 'active';
  document.getElementById('reminderDays').value = item ? item.reminderDays : 7;
  document.getElementById('show-id').textContent = item ? item.id : '(nouveau)';
  const del = document.getElementById('btn-delete');
  if(item) del.classList.remove('hidden'); else del.classList.add('hidden');
}

function closeModal(){
  const modal = document.getElementById('modal');
  if(!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  const form = document.getElementById('request-form');
  if(form) form.reset();
}

// CRUD
function saveFormFromModal(ev){
  if(ev) ev.preventDefault();
  const id = document.getElementById('request-id').value || cryptoRandomId();
  const item = {
    id,
    receivedDate: document.getElementById('receivedDate').value,
    clientName: document.getElementById('clientName').value.trim(),
    summary: document.getElementById('summary').value.trim(),
    status: document.getElementById('status').value,
    reminderDays: Number(document.getElementById('reminderDays').value),
    updatedAt: new Date().toISOString()
  };
  const existing = state.data.find(d=>d.id===id);
  if(existing){
    Object.assign(existing, item);
  } else {
    item.createdAt = new Date().toISOString();
    state.data.push(item);
  }
  saveDataToStorage();
  renderAll();
  closeModal();
  showToast('Demande enregistrée');
}

function deleteCurrentFromModal(){
  const id = document.getElementById('request-id').value;
  if(!id) return;
  if(!confirm('Supprimer cette demande ?')) return;
  state.data = state.data.filter(d=>d.id!==id);
  saveDataToStorage();
  renderAll();
  closeModal();
  showToast('Demande supprimée');
}

// Rendering Dashboard
function buildCard(item){
  const badge = computeDueStatus(item);
  const el = document.createElement('div');
  el.className = 'bg-white rounded shadow p-4 flex flex-col gap-2';
  el.setAttribute('data-status', badge);
  el.innerHTML = `
    <div class="flex justify-between items-start gap-2">
      <div>
        <div class="text-sm text-gray-500">${item.clientName}</div>
        <div class="text-lg font-semibold">${item.summary}</div>
        <div class="text-xs text-gray-500">Reçu: ${item.receivedDate} • Rappel: ${computeReminderDate(item)}</div>
      </div>
      <div class="text-right">
        <div class="text-sm">${item.status}</div>
        <div class="text-xs text-gray-400">${new Date(item.updatedAt).toLocaleString()}</div>
      </div>
    </div>
    <div class="flex gap-2 justify-end">
      <button class="btn-edit px-2 py-1 text-sm border rounded" data-id="${item.id}">Modifier</button>
      <button class="btn-delete px-2 py-1 text-sm border rounded" data-id="${item.id}">Suppr</button>
    </div>
  `;
  return el;
}

function renderDashboard(){
  const container = document.getElementById('dashboard');
  if(!container) return;

  const filter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';
  const q = document.getElementById('search') ? document.getElementById('search').value.trim().toLowerCase() : '';
  container.innerHTML = '';

  // On inclut tous les statuts présents
  const cols = {};
  state.data.forEach(it => {
    if(it.status === 'done') return;          // on ignore "done"
    if(filter !== 'all' && it.status !== filter) return;
    if(q && !(it.clientName.toLowerCase().includes(q) || it.summary.toLowerCase().includes(q))) return;

    const key = it.status || 'future';        // status vide = future
    if(!cols[key]) cols[key] = [];
    cols[key].push(it);
  });

  // Affichage
  Object.keys(cols).forEach(k => {
    const box = document.createElement('div');
    box.className = 'space-y-3';
    // Nom lisible
    const label = k === 'active' ? 'En cours' : k === 'pending' ? 'En attente' : k === 'future' ? 'À venir' : k;
    box.innerHTML = `<h3 class="text-lg font-semibold mb-2">${label} <span class="text-sm text-gray-500">(${cols[k].length})</span></h3>`;
    const list = document.createElement('div'); 
    list.className = 'flex flex-col gap-3';

    // Tri par date décroissante
    cols[k].sort((a,b)=> new Date(b.receivedDate) - new Date(a.receivedDate))
           .forEach(it=> list.appendChild(buildCard(it)));

    box.appendChild(list);
    container.appendChild(box);
  });

  // attach events
  document.querySelectorAll('.btn-edit').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.id;
    const it = state.data.find(d=>d.id===id);
    if(it) openModalWith(it);
  }));
  document.querySelectorAll('.btn-delete').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.id;
    if(!confirm('Supprimer ?')) return;
    state.data = state.data.filter(d=>d.id!==id);
    saveDataToStorage();
    renderAll();
    showToast('Supprimé');
  }));

  // Stats
  const totalEl = document.getElementById('stat-total');
  if(totalEl) totalEl.textContent = state.data.length;

  // Stat par statut connu
  ['active','pending','future'].forEach(st => {
    const el = document.getElementById('stat-' + st);
    if(el) el.textContent = state.data.filter(d=>d.status===st).length;
  });

  // Stat pour les statuts "autres"
  const futureEl = document.getElementById('stat-future');
  if(futureEl) futureEl.textContent = state.data.filter(d=>!['active','pending','future','done'].includes(d.status)).length;
}


// --- CALENDRIER ---
let calendarDate = new Date();

function renderCalendar() {
  const el = document.getElementById('calendar');
  const title = document.getElementById('monthTitle');
    if (!el) {
        console.error("Calendar container #calendar introuvable");
        return;
    }
    if (!title) {
        console.error("Titre calendrier #monthTitle introuvable");
    }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const today = new Date();

  const monthNames = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
  ];

  title.textContent = monthNames[month] + ' ' + year;
  el.innerHTML = '';

  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // Lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Cases vides avant le 1er du mois
  for (let i = 0; i < startDay; i++) {
    const blank = document.createElement('div');
    blank.className = "calendar-blank";
    el.appendChild(blank);
  }

  // Génération des jours
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    const cell = document.createElement('div');
    cell.className = 'calendar-day bg-white';

    // --- Encadrement du jour actuel ---
    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    if (isToday) {
      cell.classList.add("today-highlight"); 
      // (ta classe CSS doit encadrer avec une couleur TOTOWOOD)
    }

    // Numéro du jour
    cell.innerHTML = `<div class="date-num">${d}</div>`;

    // --- Récupération événements ---
    const items = state.data.filter(
      it => it.receivedDate === dateStr || computeReminderDate(it) === dateStr
    );

    items.forEach(it => {
      const isReminder = (computeReminderDate(it) === dateStr);
      const span = document.createElement('div');

      // classes badges TOTOWOOD
      span.className =
        'badge ' + (isReminder ? 'badge-reminder' : 'badge-received');

      span.textContent =
        (isReminder ? '[Rappel] ' : '[Reçu] ') +
        it.clientName +
        ' — ' + it.summary;

      span.title = it.summary;
      span.style.cursor = 'pointer';

      // Ouverture fiche
      span.addEventListener('click', () => openModalWith(it));

      cell.appendChild(span);
    });

    el.appendChild(cell);
  }
}


function renderAll(){
  renderCalendar();    // Calendrier d’abord
  renderDashboard();   // Puis tableau
}

// Bouton "Aujourd'hui"
const btnToday = document.getElementById('btnToday');
if(btnToday){
  btnToday.addEventListener('click', () => {
    calendarDate = new Date();
    renderAll(); // Met à jour calendrier + dashboard
  });
}

// Init and bindings
function init(){
  loadDataFromStorage();

  // Buttons and form
  const newBtn = document.getElementById('btn-new');
  if(newBtn) newBtn.addEventListener('click', ()=> openModalWith(null));

  const cancel = document.getElementById('btn-cancel');
  if(cancel) cancel.addEventListener('click', closeModal);

  const form = document.getElementById('request-form');
  if(form) form.addEventListener('submit', saveFormFromModal);

  const del = document.getElementById('btn-delete');
  if(del) del.addEventListener('click', deleteCurrentFromModal);

  // Export / Import basic (download/upload)
  const btnExport = document.getElementById('btn-export');
  if(btnExport) btnExport.addEventListener('click', ()=>{
    const payload = JSON.stringify(state.data, null, 2);
    const blob = new Blob([payload], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'totowood-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Export téléchargé');
  });

  /*
  const btnImport = document.getElementById('btn-import');
  if(btnImport) btnImport.addEventListener('click', ()=>{
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';

inp.onchange = async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  try{
    const parsed = JSON.parse(text);
    if(Array.isArray(parsed)) {
      state.data = parsed;
    } else if(parsed.data && Array.isArray(parsed.data)) {
      state.data = parsed.data;
    } else {
      throw new Error('Format JSON invalide, tableau attendu');
    }
    saveDataToStorage();
    renderAll();
    showToast('Import réussi');
  }catch(err){
    alert('Import impossible: '+err.message);
  }
};


    inp.onchange = async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const text = await file.text();
      try{
        const arr = JSON.parse(text);
        if(!Array.isArray(arr)) throw new Error('Format invalide');
        state.data = arr;
        saveDataToStorage();
        renderAll();
        showToast('Import réussi');
      }catch(err){
        alert('Import impossible: '+err.message);
      }
    };
    inp.click();
  });*/

// Import avec fusion et gestion des doublons
const btnImport = document.getElementById('btn-import');
if(btnImport){
const inp = document.createElement('input');
inp.type = 'file';
inp.accept = '.json,application/json';
inp.style.display = 'none';
document.body.appendChild(inp);
inp.addEventListener('change', async (e)=>{
const file = e.target.files[0];
if(!file) return;
try {
  const text = await file.text();
  const parsed = JSON.parse(text);
  let imported = [];

  if(Array.isArray(parsed)){
    imported = parsed;
  } else if(parsed.data && Array.isArray(parsed.data)){
    imported = parsed.data;
  } else {
    throw new Error('Format JSON invalide, tableau attendu');
  }

  // Fusionner sans doublons (basé sur l'id)
  const existingIds = new Set(state.data.map(d => d.id));
  imported.forEach(item => {
    if(!item.id) item.id = cryptoRandomId();
    if(!existingIds.has(item.id)){
      state.data.push(item);
    }
  });

  saveDataToStorage();
  renderAll();
  showToast('Import fusionné avec succès');

} catch(err) {
  alert('Import impossible: ' + err.message);
}

inp.value = ''; // permet de réimporter le même fichier
});
btnImport.addEventListener('click', ()=>{
inp.click();
});
}

/*
// Pas utile pour le moment. A voir pour la suite
  const btnOpen = document.getElementById('btn-open-file');
  if(btnOpen) btnOpen.addEventListener('click', ()=>{
    // Inform user: this demo uses localStorage. File System Access would require additional permissions.
    alert('Cette version utilise le stockage local (localStorage). Pour sauvegarder ailleurs, utilisez Export/Import.');
  });
  */

  // Filters
  const filter = document.getElementById('filter-status');
  if(filter) filter.addEventListener('change', renderDashboard);
  const search = document.getElementById('search');
  if(search) search.addEventListener('input', renderDashboard);

  // Calendar nav
  const prev = document.getElementById('prevMonth');
  if(prev) prev.addEventListener('click', ()=>{ calendarDate.setMonth(calendarDate.getMonth()-1); renderCalendar(); });
  const next = document.getElementById('nextMonth');
  if(next) next.addEventListener('click', ()=>{ calendarDate.setMonth(calendarDate.getMonth()+1); renderCalendar(); });

  // initial render
  renderAll();
}

// Start
document.addEventListener('DOMContentLoaded', init);
