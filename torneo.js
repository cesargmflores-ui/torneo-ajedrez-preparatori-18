// ESTADO GLOBAL Y PERSISTENCIA
let appData = JSON.parse(localStorage.getItem('chess_tournament_data')) || {
    students: [],
    matches: {},
    brackets: { r16: [], qf: [], sf: [], final: [] }
};

const TOTAL_GROUPS = 16;

function saveData() {
    localStorage.setItem('chess_tournament_data', JSON.stringify(appData));
}

function initGroupSelectors() {
    const selects = ['group-select', 'reg-grupo', 'schedule-filter-group', 'admin-res-group'];
    selects.forEach(selId => {
        const el = document.getElementById(selId);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = '';
        if (selId === 'schedule-filter-group') {
            el.innerHTML = '<option value="ALL">Todos los grupos y fases</option>';
        }
        for (let i = 1; i <= TOTAL_GROUPS; i++) {
            const groupName = `Grupo ${String.fromCharCode(64 + i)}`;
            el.innerHTML += `<option value="${groupName}">${groupName}</option>`;
        }
        if (currentVal) el.value = currentVal;
    });
}

function switchTab(tabId) {
    const tabs = ['home', 'rules', 'groups', 'schedule', 'brackets', 'credits', 'admin'];
    tabs.forEach(t => {
        const tabEl = document.getElementById(`tab-${t}`);
        if (tabEl) tabEl.classList.add('hidden');
        const btn = document.getElementById(`btn-${t}`);
        if (btn) {
            btn.className = "px-4 py-2 rounded-lg text-sm font-semibold transition text-slate-600 hover:text-slate-900 hover:bg-chess-border";
        }
    });
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove('hidden');

    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) {
        activeBtn.className = "px-4 py-2 rounded-lg text-sm font-semibold transition bg-amber-600 text-white shadow";
    }

    if (tabId === 'groups') renderGroups();
    if (tabId === 'schedule') renderSchedule();
    if (tabId === 'brackets') renderBracketsView();
    if (tabId === 'admin') {
        if (sessionStorage.getItem('admin_auth') === 'true') {
            document.getElementById('admin-auth-box').classList.add('hidden');
            document.getElementById('admin-dashboard').classList.remove('hidden');
            renderAdminStudents();
            populateAdminMatches();
            populateBracketMatches();
            populateAdminBracketSchedule();
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.onload = function() {
    initGroupSelectors();
    renderGroups();
    renderSchedule();
    renderBracketsView();
};