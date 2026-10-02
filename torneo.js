// ESTADO GLOBAL Y PERSISTENCIA
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA2mfU84tJWQHD-SWf4xXYuowV4N00_Ra4",
    authDomain: "torneoajedrez.firebaseapp.com",
    projectId: "torneoajedrez",
    storageBucket: "torneoajedrez.firebasestorage.app",
    messagingSenderId: "181519995288",
    appId: "1:181519995288:web:8b21c219caa7dc9d3b1bed"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.appData = {
    students: [],
    matches: {},
    brackets: { r16: [], qf: [], sf: [], final: [] }
};

const TOTAL_GROUPS = 16;
const docRef = doc(db, "torneo", "estado_actual");

window.saveData = async function() {
    try {
        await setDoc(docRef, window.appData);
    } catch (e) {
        console.error("Error al guardar en la nube: ", e);
        alert("Hubo un error al sincronizar con la nube.");
    }
}

async function loadDataFromCloud() {
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            window.appData = docSnap.data();
        } else {
            await setDoc(docRef, window.appData);
        }
    } catch (e) {
        console.error("Error al cargar datos de la nube: ", e);
    }

    initGroupSelectors();
    initScheduleDateFilter();
    updateStatCounters();
    renderGroups();
    renderSchedule();
    renderBracketsView();
}

window.reiniciarTorneo = async function() {
    if (!confirm('¿Estás seguro de reiniciar el torneo en la nube? Esto borrará brackets y fechas eliminatorias.')) {
        return;
    }
    window.appData.brackets = { r16: [], qf: [], sf: [], final: [] };
    await saveData();
    initScheduleDateFilter();
    renderSchedule();
    renderBracketsView();
    populateBracketMatches();
    populateAdminBracketSchedule();
    alert('¡El torneo se ha reiniciado en la nube con éxito!');
}

window.initGroupSelectors = function() {
    // Selectores que SÍ usan los grupos de la A a la P
    const normalSelects = ['group-select', 'reg-grupo', 'admin-res-group'];
    normalSelects.forEach(selId => {
        const el = document.getElementById(selId);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = '';
        for (let i = 1; i <= TOTAL_GROUPS; i++) {
            const groupName = `Grupo ${String.fromCharCode(64 + i)}`;
            el.innerHTML += `<option value="${groupName}">${groupName}</option>`;
        }
        if (currentVal) el.value = currentVal;
    });

    // Inicializar también el filtro de fechas del calendario
    initScheduleDateFilter();
}

// NUEVA FUNCIÓN: Poblar el filtro del calendario con las fechas de los partidos programados
window.initScheduleDateFilter = function() {
    const scheduleFilter = document.getElementById('schedule-filter-group');
    if (!scheduleFilter) return;

    const currentVal = scheduleFilter.value;
    let datesSet = new Set();

    // 1. Recopilar fechas de la fase de grupos
    if (window.appData && window.appData.matches) {
        for (let gKey in window.appData.matches) {
            window.appData.matches[gKey].forEach(m => {
                if (m.fecha) {
                    datesSet.add(m.fecha.split('T')[0]);
                }
            });
        }
    }

    // 2. Recopilar fechas de las fases eliminatorias (brackets)
    if (window.appData && window.appData.brackets) {
        const bracketRounds = ['r16', 'qf', 'sf', 'final'];
        bracketRounds.forEach(round => {
            (window.appData.brackets[round] || []).forEach(m => {
                if (m.fecha) {
                    datesSet.add(m.fecha.split('T')[0]);
                }
            });
        });
    }

    let sortedDates = Array.from(datesSet).sort();

    let htmlOptions = `<option value="ALL">Todas las fechas</option>`;
    sortedDates.forEach(dateStr => {
        const [year, month, day] = dateStr.split('-');
        const formattedLabel = `${day}/${month}/${year}`;
        htmlOptions += `<option value="${dateStr}">${formattedLabel}</option>`;
    });

    scheduleFilter.innerHTML = htmlOptions;
    if (currentVal && scheduleFilter.querySelector(`option[value="${currentVal}"]`)) {
        scheduleFilter.value = currentVal;
    }
}

window.switchTab = function(tabId) {
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
    if (tabId === 'schedule') {
        initScheduleDateFilter();
        renderSchedule();
    }
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

window.authenticateAdmin = function(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass-input').value;
    if (pass === 'Puro501chingonyelprofealonsotambien') {
        sessionStorage.setItem('admin_auth', 'true');
        document.getElementById('admin-auth-box').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        renderAdminStudents();
        populateAdminMatches();
        populateBracketMatches();
        populateAdminBracketSchedule();
    } else {
        alert('Contraseña incorrecta.');
    }
}

window.logoutAdmin = function() {
    sessionStorage.removeItem('admin_auth');
    document.getElementById('admin-auth-box').classList.remove('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('admin-pass-input').value = '';
}

window.registerStudent = async function(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const apellido = document.getElementById('reg-apellido').value.trim();
    const grupo = document.getElementById('reg-grupo').value;

    const newStudent = {
        id: 'stu_' + Date.now() + Math.random().toString(36).substr(2, 5),
        nombre,
        apellido,
        grupo,
        pj: 0, g: 0, e: 0, p: 0, pts: 0
    };

    window.appData.students.push(newStudent);
    regenerateGroupMatches(grupo);
    await saveData();

    document.getElementById('reg-nombre').value = '';
    document.getElementById('reg-apellido').value = '';
    updateStatCounters();
    renderAdminStudents();
    populateAdminMatches();
    initScheduleDateFilter();
    alert(`¡Estudiante ${nombre} ${apellido} registrado en la nube (${grupo})!`);
}

window.deleteStudent = async function(studentId) {
    if (!confirm('¿Estás seguro de eliminar a este estudiante de la nube?')) return;

    const student = window.appData.students.find(s => s.id === studentId);
    if (student) {
        for (let gKey in window.appData.matches) {
            window.appData.matches[gKey].forEach(m => {
                if ((m.whiteId === studentId || m.blackId === studentId) && m.result) {
                    const rivalId = m.whiteId === studentId ? m.blackId : m.whiteId;
                    const rival = window.appData.students.find(s => s.id === rivalId);
                    if (rival) {
                        rival.pj--;
                        if (m.result === 'DRAW') { rival.e--; rival.pts -= 0.5; }
                        else if ((m.result === 'WHITE' && m.whiteId === rivalId) || (m.result === 'BLACK' && m.blackId === rivalId)) {
                            rival.g--; rival.pts -= 1.0;
                        } else {
                            rival.p--;
                        }
                    }
                }
            });
        }
    }

    window.appData.students = window.appData.students.filter(s => s.id !== studentId);
    for (let gKey in window.appData.matches) {
        window.appData.matches[gKey] = window.appData.matches[gKey].filter(m => m.whiteId !== studentId && m.blackId !== studentId);
    }

    await saveData();
    updateStatCounters();
    renderAdminStudents();
    populateAdminMatches();
    initScheduleDateFilter();
    alert('Estudiante eliminado y nube sincronizada.');
}

function regenerateGroupMatches(grupo) {
    const groupStudents = window.appData.students.filter(s => s.grupo === grupo);
    window.appData.matches[grupo] = [];

    if (groupStudents.length < 2) return;

    for (let i = 0; i < groupStudents.length; i++) {
        for (let j = i + 1; j < groupStudents.length; j++) {
            const s1 = groupStudents[i];
            const s2 = groupStudents[j];
            const white = (i + j) % 2 === 0 ? s1 : s2;
            const black = (i + j) % 2 === 0 ? s2 : s1;

            window.appData.matches[grupo].push({
                id: `match_${grupo}_${i}_${j}_${Date.now()}`,
                whiteId: white.id,
                blackId: black.id,
                result: null,
                fecha: ''
            });
        }
    }
}

window.renderGroups = function() {
    const group = document.getElementById('group-select').value;
    const groupStudents = window.appData.students.filter(s => s.grupo === group);

    groupStudents.sort((a, b) => b.pts - a.pts);

    const tbody = document.getElementById('group-table-body');
    tbody.innerHTML = '';

    if (groupStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">No hay estudiantes registrados en este grupo.</td></tr>`;
        return;
    }

    groupStudents.forEach((st, idx) => {
        let trendIcon = `<span class="text-slate-400">—</span>`;
        if (idx === 0 && groupStudents.length > 1) trendIcon = `<span class="text-emerald-600 font-bold">▲ Arriba</span>`;
        else if (idx === groupStudents.length - 1 && groupStudents.length > 1) trendIcon = `<span class="text-rose-600 font-bold">▼ Abajo</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-4 font-bold text-amber-600">${idx + 1}</td>
                <td class="p-4 font-semibold text-slate-900">${st.nombre} ${st.apellido}</td>
                <td class="p-4 text-center">${st.pj}</td>
                <td class="p-4 text-center text-emerald-600">${st.g}</td>
                <td class="p-4 text-center text-amber-600">${st.e}</td>
                <td class="p-4 text-center text-rose-600">${st.p}</td>
                <td class="p-4 text-center font-bold text-amber-600">${st.pts}</td>
                <td class="p-4 text-center text-xs">${trendIcon}</td>
            </tr>
        `;
    });
}

// ACTUALIZADO: Renderizar el calendario filtrando y ordenando por fecha
window.renderSchedule = function() {
    const filterVal = document.getElementById('schedule-filter-group').value; // Valor YYYY-MM-DD o 'ALL'
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    let itemsToShow = [];

    // Recopilar partidos de la fase de grupos
    if (window.appData && window.appData.matches) {
        for (let gKey in window.appData.matches) {
            window.appData.matches[gKey].forEach(m => {
                if (!m.fecha) return; // Si no tiene fecha asignada, no se muestra en el calendario de fechas
                const matchDatePart = m.fecha.split('T')[0];

                if (filterVal === 'ALL' || matchDatePart === filterVal) {
                    const whiteStudent = window.appData.students.find(s => s.id === m.whiteId);
                    const blackStudent = window.appData.students.find(s => s.id === m.blackId);
                    if (whiteStudent && blackStudent) {
                        itemsToShow.push({
                            tipo: 'grupo',
                            subtitulo: `Fase de Grupos — ${gKey}`,
                            p1: `${whiteStudent.nombre} ${whiteStudent.apellido}`,
                            p2: `${blackStudent.nombre} ${blackStudent.apellido}`,
                            label1: 'Blancas',
                            label2: 'Negras',
                            result: m.result,
                            fecha: m.fecha
                        });
                    }
                }
            });
        }
    }

    // Recopilar partidos de eliminatorias (brackets)
    const bracketRounds = [
        { key: 'r16', name: 'Octavos de Final' },
        { key: 'qf', name: 'Cuartos de Final' },
        { key: 'sf', name: 'Semifinales' },
        { key: 'final', name: 'Gran Final' }
    ];

    if (window.appData && window.appData.brackets) {
        bracketRounds.forEach(round => {
            (window.appData.brackets[round.key] || []).forEach(m => {
                if (!m.fecha) return;
                const matchDatePart = m.fecha.split('T')[0];

                if (filterVal === 'ALL' || matchDatePart === filterVal) {
                    itemsToShow.push({
                        tipo: 'bracket',
                        subtitulo: round.name,
                        p1: m.p1,
                        p2: m.p2,
                        label1: 'Participante 1',
                        label2: 'Participante 2',
                        winner: m.winner,
                        fecha: m.fecha
                    });
                }
            });
        });
    }

    // Ordenar cronológicamente por fecha y hora exacta
    itemsToShow.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (itemsToShow.length === 0) {
        container.innerHTML = `<div class="col-span-2 bg-chess-card border border-chess-border p-8 rounded-2xl text-center text-slate-400">No hay enfrentamientos programados para esta fecha.</div>`;
        return;
    }

    itemsToShow.forEach((item) => {
        let statusBadge = `<span class="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">Próximo Encuentro</span>`;

        if (item.tipo === 'grupo') {
            if (item.result === 'WHITE') statusBadge = `<span class="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">Ganó Blancas</span>`;
            if (item.result === 'BLACK') statusBadge = `<span class="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">Ganó Negras</span>`;
            if (item.result === 'DRAW') statusBadge = `<span class="text-xs bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full border border-yellow-200">Tablas (Empate)</span>`;
        } else {
            if (item.winner) statusBadge = `<span class="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">Ganador: ${item.winner}</span>`;
        }

        let fechaFormatted = new Date(item.fecha).toLocaleString();

        container.innerHTML += `
            <div class="bg-chess-card border border-chess-border p-6 rounded-2xl shadow-sm space-y-4">
                <div class="flex justify-between items-center text-xs text-slate-500 border-b border-chess-border pb-3">
                    <span class="font-bold text-amber-600">${item.subtitulo}</span>
                    ${statusBadge}
                </div>
                <div class="text-xs text-slate-600 flex items-center gap-2">
                    <i class="fa-solid fa-clock text-amber-600"></i> <span><b>Fecha y Hora:</b> ${fechaFormatted}</span>
                </div>
                <div class="grid grid-cols-2 gap-4 items-center">
                    <div class="bg-chess-dark p-3.5 rounded-xl border border-chess-border text-center">
                        <span class="text-[10px] uppercase font-bold text-slate-500 block mb-1">${item.label1}</span>
                        <span class="font-bold text-slate-900 text-sm">${item.p1}</span>
                    </div>
                    <div class="bg-chess-dark p-3.5 rounded-xl border border-chess-border text-center">
                        <span class="text-[10px] uppercase font-bold text-slate-500 block mb-1">${item.label2}</span>
                        <span class="font-bold text-slate-900 text-sm">${item.p2}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

window.populateAdminMatches = function() {
    const group = document.getElementById('admin-res-group').value;
    const matchSelect = document.getElementById('admin-res-match');
    if (!matchSelect) return;
    matchSelect.innerHTML = '';

    const matches = window.appData.matches[group] || [];
    if (matches.length === 0) {
        matchSelect.innerHTML = `<option value="">No hay partidas en este grupo</option>`;
        return;
    }

    matches.forEach((m) => {
        const w = window.appData.students.find(s => s.id === m.whiteId);
        const b = window.appData.students.find(s => s.id === m.blackId);
        if (w && b) {
            const statusText = m.result ? ` [Jugado]` : (m.fecha ? ` [Programado]` : '');
            matchSelect.innerHTML += `<option value="${m.id}">[Blancas] ${w.nombre} vs [Negras] ${b.nombre}${statusText}</option>`;
        }
    });
    loadMatchDateToInput();
}

window.loadMatchDateToInput = function() {
    const group = document.getElementById('admin-res-group').value;
    const matchId = document.getElementById('admin-res-match').value;
    const dateInput = document.getElementById('admin-res-date');
    if (!matchId || !dateInput) return;

    const match = (window.appData.matches[group] || []).find(m => m.id === matchId);
    if (match && match.fecha) {
        dateInput.value = match.fecha;
    } else {
        dateInput.value = '';
    }
}

window.saveMatchDateOnly = async function() {
    const group = document.getElementById('admin-res-group').value;
    const matchId = document.getElementById('admin-res-match').value;
    const newDate = document.getElementById('admin-res-date').value;

    if (!matchId) {
        alert('Selecciona una partida válida.');
        return;
    }
    const match = (window.appData.matches[group] || []).find(m => m.id === matchId);
    if (!match) return;

    match.fecha = newDate;
    await saveData();
    populateAdminMatches();
    initScheduleDateFilter();
    alert('¡Fecha y hora programadas en la nube!');
}

window.saveMatchResultOnly = async function() {
    const group = document.getElementById('admin-res-group').value;
    const matchId = document.getElementById('admin-res-match').value;
    const outcome = document.getElementById('admin-res-outcome').value;

    if (!matchId) {
        alert('Selecciona una partida válida.');
        return;
    }
    const match = (window.appData.matches[group] || []).find(m => m.id === matchId);
    if (!match) return;

    if (match.result) {
        const wSt = window.appData.students.find(s => s.id === match.whiteId);
        const bSt = window.appData.students.find(s => s.id === match.blackId);
        if (wSt && bSt) {
            wSt.pj--; bSt.pj--;
            if (match.result === 'WHITE') { wSt.g--; wSt.pts -= 1; bSt.p--; }
            else if (match.result === 'BLACK') { bSt.g--; bSt.pts -= 1; wSt.p--; }
            else if (match.result === 'DRAW') { wSt.e--; wSt.pts -= 0.5; bSt.e--; bSt.pts -= 0.5; }
        }
    }

    match.result = outcome;
    const whiteStudent = window.appData.students.find(s => s.id === match.whiteId);
    const blackStudent = window.appData.students.find(s => s.id === match.blackId);

    if (whiteStudent && blackStudent) {
        whiteStudent.pj++;
        blackStudent.pj++;

        if (outcome === 'WHITE') {
            whiteStudent.g++; whiteStudent.pts += 1.0;
            blackStudent.p++;
        } else if (outcome === 'BLACK') {
            blackStudent.g++; blackStudent.pts += 1.0;
            whiteStudent.p++;
        } else if (outcome === 'DRAW') {
            whiteStudent.e++; whiteStudent.pts += 0.5;
            blackStudent.e++; blackStudent.pts += 0.5;
        }
    }

    await saveData();
    populateAdminMatches();
    alert('¡Resultado guardado en la nube y posiciones actualizadas!');
}

window.generateBrackets = async function() {
    for (let gKey in window.appData.matches) {
        const matchesInGroup = window.appData.matches[gKey];
        for (let m of matchesInGroup) {
            if (!m.result) {
                alert(`Hay partidas pendientes en el ${gKey}. Deben jugarse antes de generar octavos.`);
                return;
            }
        }
    }

    let qualified = [];
    for (let i = 1; i <= TOTAL_GROUPS; i++) {
        const gName = `Grupo ${String.fromCharCode(64 + i)}`;
        const gStudents = window.appData.students.filter(s => s.grupo === gName);
        gStudents.sort((a, b) => b.pts - a.pts);
        if (gStudents.length > 0) {
            qualified.push(`${gStudents[0].nombre} ${gStudents[0].apellido}`);
        }
    }

    if (qualified.length < 2) {
        alert('Se necesitan al menos 2 estudiantes clasificados.');
        return;
    }

    window.appData.brackets.r16 = [];
    for (let i = 0; i < 8; i++) {
        window.appData.brackets.r16.push({
            id: `r16_${i}`,
            p1: qualified[i * 2] || 'Por definir',
            p2: qualified[i * 2 + 1] || 'Por definir',
            winner: null,
            fecha: ''
        });
    }

    window.appData.brackets.qf = [ {id:'qf_0', p1:'Ganador R16 #1', p2:'Ganador R16 #2', winner:null, fecha:''}, {id:'qf_1', p1:'Ganador R16 #3', p2:'Ganador R16 #4', winner:null, fecha:''}, {id:'qf_2', p1:'Ganador R16 #5', p2:'Ganador R16 #6', winner:null, fecha:''}, {id:'qf_3', p1:'Ganador R16 #7', p2:'Ganador R16 #8', winner:null, fecha:''} ];
    window.appData.brackets.sf = [ {id:'sf_0', p1:'Ganador QF #1', p2:'Ganador QF #2', winner:null, fecha:''}, {id:'sf_1', p1:'Ganador QF #3', p2:'Ganador QF #4', winner:null, fecha:''} ];
    window.appData.brackets.final = [ {id:'final_0', p1:'Ganador SF #1', p2:'Ganador SF #2', winner:null, fecha:''} ];

    await saveData();
    renderBracketsView();
    populateBracketMatches();
    populateAdminBracketSchedule();
    initScheduleDateFilter();
    alert('¡Octavos de Final generados y guardados en la nube!');
}

window.populateBracketMatches = function() {
    const round = document.getElementById('admin-bracket-round').value;
    const matchSelect = document.getElementById('admin-bracket-match');
    if (!matchSelect) return;

    matchSelect.innerHTML = '';
    const matches = window.appData.brackets[round] || [];

    if (matches.length === 0) {
        matchSelect.innerHTML = `<option value="">Genera los brackets primero</option>`;
        return;
    }

    matches.forEach((m) => {
        const wText = m.winner ? ` [Ganador: ${m.winner}]` : '';
        matchSelect.innerHTML += `<option value="${m.id}">${m.p1} vs ${m.p2}${wText}</option>`;
    });
}

window.populateAdminBracketSchedule = function() {
    const round = document.getElementById('admin-bracket-sched-round').value;
    const matchSelect = document.getElementById('admin-bracket-sched-match');
    const dateInput = document.getElementById('admin-bracket-sched-date');
    if (!matchSelect || !dateInput) return;

    matchSelect.innerHTML = '';
    const matches = window.appData.brackets[round] || [];

    if (matches.length === 0) {
        matchSelect.innerHTML = `<option value="">No hay llaves en esta ronda</option>`;
        dateInput.value = '';
        return;
    }

    matches.forEach((m) => {
        matchSelect.innerHTML += `<option value="${m.id}">${m.p1} vs ${m.p2}</option>`;
    });
    loadBracketDateToInput();
}

window.loadBracketDateToInput = function() {
    const round = document.getElementById('admin-bracket-sched-round').value;
    const matchId = document.getElementById('admin-bracket-sched-match').value;
    const dateInput = document.getElementById('admin-bracket-sched-date');
    if (!matchId || !dateInput) return;

    const match = (window.appData.brackets[round] || []).find(m => m.id === matchId);
    if (match && match.fecha) {
        dateInput.value = match.fecha;
    } else {
        dateInput.value = '';
    }
}

window.saveBracketDate = async function() {
    const round = document.getElementById('admin-bracket-sched-round').value;
    const matchId = document.getElementById('admin-bracket-sched-match').value;
    const newDate = document.getElementById('admin-bracket-sched-date').value;

    if (!matchId) {
        alert('Selecciona una llave válida.');
        return;
    }
    const match = (window.appData.brackets[round] || []).find(m => m.id === matchId);
    if (!match) return;

    match.fecha = newDate;
    await saveData();
    populateAdminBracketSchedule();
    initScheduleDateFilter();
    alert('¡Fecha de llave guardada en la nube!');
}

window.saveBracketWinner = async function() {
    const round = document.getElementById('admin-bracket-round').value;
    const matchId = document.getElementById('admin-bracket-match').value;
    const winnerChoice = document.getElementById('admin-bracket-winner').value;

    if (!matchId) {
        alert('Selecciona una llave válida.');
        return;
    }

    const matches = window.appData.brackets[round] || [];
    const matchObj = matches.find(m => m.id === matchId);
    if (!matchObj) return;

    const winningName = winnerChoice === '1' ? matchObj.p1 : matchObj.p2;
    matchObj.winner = winningName;

    const matchIndex = matches.indexOf(matchObj);
    if (round === 'r16') {
        const qfIndex = Math.floor(matchIndex / 2);
        const qfMatch = window.appData.brackets.qf[qfIndex];
        if (qfMatch) {
            if (matchIndex % 2 === 0) qfMatch.p1 = winningName;
            else qfMatch.p2 = winningName;
        }
    } else if (round === 'qf') {
        const sfIndex = Math.floor(matchIndex / 2);
        const sfMatch = window.appData.brackets.sf[sfIndex];
        if (sfMatch) {
            if (matchIndex % 2 === 0) sfMatch.p1 = winningName;
            else sfMatch.p2 = winningName;
        }
    } else if (round === 'sf') {
        const finalMatch = window.appData.brackets.final[0];
        if (finalMatch) {
            if (matchIndex === 0) finalMatch.p1 = winningName;
            else finalMatch.p2 = winningName;
        }
    }

    await saveData();
    renderBracketsView();
    populateBracketMatches();
    populateAdminBracketSchedule();
    alert(`¡Ganador guardado en la nube! ${winningName} avanza.`);
}

window.renderBracketsView = function() {
    const r16Container = document.getElementById('bracket-r16');
    const qfContainer = document.getElementById('bracket-qf');
    const sfContainer = document.getElementById('bracket-sf');
    const finalContainer = document.getElementById('bracket-final');

    if (!r16Container) return;

    r16Container.innerHTML = '';
    (window.appData.brackets.r16 || []).forEach((m, idx) => {
        r16Container.innerHTML += `
            <div class="bg-chess-dark p-3 rounded-xl border border-chess-border text-xs space-y-1">
                <div class="text-slate-500 font-bold mb-1">Octavos #${idx + 1}</div>
                <div class="text-slate-900 px-2.5 py-1.5 rounded ${m.winner === m.p1 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-slate-900 px-2.5 py-1.5 rounded ${m.winner === m.p2 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });

    qfContainer.innerHTML = '';
    (window.appData.brackets.qf || []).forEach((m, idx) => {
        qfContainer.innerHTML += `
            <div class="bg-chess-dark p-3 rounded-xl border border-chess-border text-xs space-y-1">
                <div class="text-amber-700 font-bold mb-1">Cuartos #${idx + 1}</div>
                <div class="text-slate-900 px-2.5 py-1.5 rounded ${m.winner === m.p1 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-slate-900 px-2.5 py-1.5 rounded ${m.winner === m.p2 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });

    sfContainer.innerHTML = '';
    (window.appData.brackets.sf || []).forEach((m, idx) => {
        sfContainer.innerHTML += `
            <div class="bg-chess-dark p-3 rounded-xl border border-chess-border text-xs space-y-1">
                <div class="text-amber-700 font-bold mb-1">Semifinal #${idx + 1}</div>
                <div class="text-slate-900 px-2.5 py-1.5 rounded ${m.winner === m.p1 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-slate-900 px-2.5 py-1.5 rounded ${m.winner === m.p2 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });

    finalContainer.innerHTML = '';
    (window.appData.brackets.final || []).forEach((m) => {
        finalContainer.innerHTML += `
            <div class="bg-gradient-to-br from-amber-50 to-chess-dark p-4 rounded-xl border border-amber-300 text-xs space-y-2 text-center shadow-md">
                <div class="text-amber-700 font-extrabold uppercase tracking-wide"><i class="fa-solid fa-crown mr-1"></i> Gran Final</div>
                <div class="text-slate-900 px-3 py-2 rounded font-semibold ${m.winner === m.p1 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-slate-500 font-bold">VS</div>
                <div class="text-slate-900 px-3 py-2 rounded font-semibold ${m.winner === m.p2 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });
}

window.renderAdminStudents = function() {
    const tbody = document.getElementById('admin-students-tbody');
    const countEl = document.getElementById('admin-student-count');
    if (!tbody) return;

    tbody.innerHTML = '';
    countEl.innerText = `Total: ${window.appData.students.length}`;

    if (window.appData.students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400">No hay estudiantes registrados.</td></tr>`;
        return;
    }

    window.appData.students.forEach(st => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 font-semibold text-slate-900">${st.nombre} ${st.apellido}</td>
                <td class="p-3 text-amber-600">${st.grupo}</td>
                <td class="p-3 text-center">
                    <button onclick="deleteStudent('${st.id}')" class="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs hover:bg-red-100 transition"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

window.updateStatCounters = function() {
    const statEl = document.getElementById('stat-students');
    if (statEl) statEl.innerText = window.appData.students.length;
}

window.onload = function() {
    loadDataFromCloud();
};