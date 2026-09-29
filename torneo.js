// ESTADO GLOBAL Y PERSISTENCIA EN LOCALSTORAGE
let appData = JSON.parse(localStorage.getItem('chess_tournament_data')) || {
    students: [], // [{ id, nombre, apellido, grupo, pj, g, e, p, pts }]
    matches: {},  // { grupoId: [ { id, whiteId, blackId, result: null, fecha: '' } ] }
    brackets: { r16: [], qf: [], sf: [], final: [] }
};

const TOTAL_GROUPS = 16;

function saveData() {
    localStorage.setItem('chess_tournament_data', JSON.stringify(appData));
}

// INICIALIZACIÓN DE SELECTS DE GRUPOS
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

// NAVEGACIÓN ENTRE PESTAÑAS
function switchTab(tabId) {
    const tabs = ['home', 'rules', 'groups', 'schedule', 'brackets', 'admin'];
    tabs.forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        const btn = document.getElementById(`btn-${t}`);
        if (btn) {
            btn.className = "px-4 py-2 rounded-lg text-sm font-semibold transition text-gray-300 hover:text-white hover:bg-chess-border";
        }
    });
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) {
        if (tabId === 'admin') {
            activeBtn.className = "px-4 py-2 rounded-lg text-sm font-semibold transition bg-amber-500 text-chess-darker shadow";
        } else {
            activeBtn.className = "px-4 py-2 rounded-lg text-sm font-semibold transition bg-chess-accent text-chess-darker shadow";
        }
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

// AUTENTICACIÓN ADMIN
function authenticateAdmin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass-input').value;
    if (pass === 'admin123') {
        sessionStorage.setItem('admin_auth', 'true');
        document.getElementById('admin-auth-box').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        renderAdminStudents();
        populateAdminMatches();
        populateBracketMatches();
        populateAdminBracketSchedule();
    } else {
        alert('Contraseña incorrecta. (Prueba con admin123)');
    }
}

function logoutAdmin() {
    sessionStorage.removeItem('admin_auth');
    document.getElementById('admin-auth-box').classList.remove('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('admin-pass-input').value = '';
}

// REGISTRAR ESTUDIANTE Y REGENERAR ENFRENTAMIENTOS
function registerStudent(e) {
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

    appData.students.push(newStudent);
    regenerateGroupMatches(grupo);
    saveData();

    document.getElementById('reg-nombre').value = '';
    document.getElementById('reg-apellido').value = '';
    updateStatCounters();
    renderAdminStudents();
    populateAdminMatches();
    alert(`¡Estudiante ${nombre} ${apellido} registrado con éxito en el ${grupo}!`);
}

// ELIMINAR ESTUDIANTE
function deleteStudent(studentId) {
    if (!confirm('¿Estás seguro de eliminar a este estudiante? Se limpiarán sus puntos y enfrentamientos.')) return;
    
    const student = appData.students.find(s => s.id === studentId);
    if (student) {
        for (let gKey in appData.matches) {
            appData.matches[gKey].forEach(m => {
                if ((m.whiteId === studentId || m.blackId === studentId) && m.result) {
                    const rivalId = m.whiteId === studentId ? m.blackId : m.whiteId;
                    const rival = appData.students.find(s => s.id === rivalId);
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

    appData.students = appData.students.filter(s => s.id !== studentId);
    for (let gKey in appData.matches) {
        appData.matches[gKey] = appData.matches[gKey].filter(m => m.whiteId !== studentId && m.blackId !== studentId);
    }

    saveData();
    updateStatCounters();
    renderAdminStudents();
    populateAdminMatches();
    alert('Estudiante eliminado y datos sincronizados correctamente.');
}

// REGENERAR EMPAREJAMIENTOS CON BALANCE DE PIEZAS
function regenerateGroupMatches(grupo) {
    const groupStudents = appData.students.filter(s => s.grupo === grupo);
    appData.matches[grupo] = [];

    if (groupStudents.length < 2) return;

    for (let i = 0; i < groupStudents.length; i++) {
        for (let j = i + 1; j < groupStudents.length; j++) {
            const s1 = groupStudents[i];
            const s2 = groupStudents[j];
            const white = (i + j) % 2 === 0 ? s1 : s2;
            const black = (i + j) % 2 === 0 ? s2 : s1;

            appData.matches[grupo].push({
                id: `match_${grupo}_${i}_${j}_${Date.now()}`,
                whiteId: white.id,
                blackId: black.id,
                result: null,
                fecha: ''
            });
        }
    }
}

// RENDERIZAR TABLA DE POSICIONES DE GRUPOS
function renderGroups() {
    const group = document.getElementById('group-select').value;
    document.getElementById('current-group-title').innerText = `Posiciones - ${group}`;
    const groupStudents = appData.students.filter(s => s.grupo === group);

    groupStudents.sort((a, b) => b.pts - a.pts);

    const tbody = document.getElementById('group-table-body');
    tbody.innerHTML = '';

    if (groupStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-400">No hay estudiantes registrados en este grupo.</td></tr>`;
        return;
    }

    groupStudents.forEach((st, idx) => {
        let trendIcon = `<span class="text-gray-500">—</span>`;
        if (idx === 0 && groupStudents.length > 1) trendIcon = `<span class="text-emerald-400 font-bold">▲ Arriba</span>`;
        else if (idx === groupStudents.length - 1 && groupStudents.length > 1) trendIcon = `<span class="text-rose-400 font-bold">▼ Abajo</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-chess-dark transition">
                <td class="p-4 font-bold text-amber-400">${idx + 1}</td>
                <td class="p-4 font-semibold text-white">${st.nombre} ${st.apellido}</td>
                <td class="p-4 text-center">${st.pj}</td>
                <td class="p-4 text-center text-emerald-400">${st.g}</td>
                <td class="p-4 text-center text-amber-400">${st.e}</td>
                <td class="p-4 text-center text-rose-400">${st.p}</td>
                <td class="p-4 text-center font-bold text-amber-400">${st.pts}</td>
                <td class="p-4 text-center text-xs">${trendIcon}</td>
            </tr>
        `;
    });
}

// RENDERIZAR CALENDARIO (INCLUYE GRUPOS Y BRACKETS)
function renderSchedule() {
    const filterGroup = document.getElementById('schedule-filter-group').value;
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    let itemsToShow = [];

    // 1. Añadir partidos de grupos
    for (let gKey in appData.matches) {
        if (filterGroup === 'ALL' || filterGroup === gKey) {
            appData.matches[gKey].forEach(m => {
                const whiteStudent = appData.students.find(s => s.id === m.whiteId);
                const blackStudent = appData.students.find(s => s.id === m.blackId);
                if (whiteStudent && blackStudent) {
                    itemsToShow.push({
                        tipo: 'grupo',
                        subtitulo: `${gKey}`,
                        p1: `${whiteStudent.nombre} ${whiteStudent.apellido}`,
                        p2: `${blackStudent.nombre} ${blackStudent.apellido}`,
                        label1: 'Blancas',
                        label2: 'Negras',
                        result: m.result,
                        fecha: m.fecha
                    });
                }
            });
        }
    }

    // 2. Añadir partidos de Eliminación Directa (Brackets)
    const bracketRounds = [
        { key: 'r16', name: 'Octavos de Final' },
        { key: 'qf', name: 'Cuartos de Final' },
        { key: 'sf', name: 'Semifinales' },
        { key: 'final', name: 'Gran Final' }
    ];

    bracketRounds.forEach(round => {
        if (filterGroup === 'ALL' || filterGroup === round.name) {
            (appData.brackets[round.key] || []).forEach(m => {
                itemsToShow.push({
                    tipo: 'bracket',
                    subtitulo: round.name,
                    p1: m.p1,
                    p2: m.p2,
                    label1: 'Participante 1',
                    label2: 'Participante 2',
                    winner: m.winner,
                    fecha: m.fecha || ''
                });
            });
        }
    });

    if (itemsToShow.length === 0) {
        container.innerHTML = `<div class="col-span-2 bg-chess-card border border-chess-border p-8 rounded-2xl text-center text-gray-400">No hay enfrentamientos programados todavía.</div>`;
        return;
    }

    itemsToShow.forEach((item, idx) => {
        let statusBadge = `<span class="text-xs bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">Próximo Encuentro</span>`;
        
        if (item.tipo === 'grupo') {
            if (item.result === 'WHITE') statusBadge = `<span class="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">Ganó Blancas</span>`;
            if (item.result === 'BLACK') statusBadge = `<span class="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30">Ganó Negras</span>`;
            if (item.result === 'DRAW') statusBadge = `<span class="text-xs bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full border border-yellow-500/30">Tablas (Empate)</span>`;
        } else {
            if (item.winner) statusBadge = `<span class="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">Ganador: ${item.winner}</span>`;
        }

        let fechaFormatted = item.fecha ? new Date(item.fecha).toLocaleString() : 'Fecha por programar';

        container.innerHTML += `
            <div class="bg-chess-card border border-chess-border p-6 rounded-2xl shadow-md space-y-4">
                <div class="flex justify-between items-center text-xs text-gray-400 border-b border-chess-border pb-3">
                    <span class="font-bold text-amber-400">${item.subtitulo} — Encuentro #${idx + 1}</span>
                    ${statusBadge}
                </div>
                <div class="text-xs text-gray-300 flex items-center gap-2">
                    <i class="fa-solid fa-clock text-amber-500"></i> <span><b>Fecha Programada:</b> ${fechaFormatted}</span>
                </div>
                <div class="grid grid-cols-2 gap-4 items-center">
                    <div class="bg-chess-dark p-3.5 rounded-xl border border-chess-border text-center">
                        <span class="text-[10px] uppercase font-bold text-gray-400 block mb-1">${item.label1}</span>
                        <span class="font-bold text-white text-sm">${item.p1}</span>
                    </div>
                    <div class="bg-chess-dark p-3.5 rounded-xl border border-chess-border text-center">
                        <span class="text-[10px] uppercase font-bold text-gray-400 block mb-1">${item.label2}</span>
                        <span class="font-bold text-white text-sm">${item.p2}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

// ADMINISTRACIÓN DE PARTIDAS DE GRUPO (SEPARAR FECHA Y RESULTADO)
function populateAdminMatches() {
    const group = document.getElementById('admin-res-group').value;
    const matchSelect = document.getElementById('admin-res-match');
    if (!matchSelect) return;
    matchSelect.innerHTML = '';

    const matches = appData.matches[group] || [];
    if (matches.length === 0) {
        matchSelect.innerHTML = `<option value="">No hay partidas en este grupo</option>`;
        return;
    }

    matches.forEach((m) => {
        const w = appData.students.find(s => s.id === m.whiteId);
        const b = appData.students.find(s => s.id === m.blackId);
        if (w && b) {
            const statusText = m.result ? ` [Jugado]` : (m.fecha ? ` [Programado]` : '');
            matchSelect.innerHTML += `<option value="${m.id}">[Blancas] ${w.nombre} vs [Negras] ${b.nombre}${statusText}</option>`;
        }
    });
    loadMatchDateToInput();
}

function loadMatchDateToInput() {
    const group = document.getElementById('admin-res-group').value;
    const matchId = document.getElementById('admin-res-match').value;
    const dateInput = document.getElementById('admin-res-date');
    if (!matchId || !dateInput) return;

    const match = (appData.matches[group] || []).find(m => m.id === matchId);
    if (match && match.fecha) {
        dateInput.value = match.fecha;
    } else {
        dateInput.value = '';
    }
}

// GUARDAR SÓLO LA FECHA DE LA PARTIDA DE GRUPO
function saveMatchDateOnly() {
    const group = document.getElementById('admin-res-group').value;
    const matchId = document.getElementById('admin-res-match').value;
    const newDate = document.getElementById('admin-res-date').value;

    if (!matchId) {
        alert('Selecciona una partida válida.');
        return;
    }
    const match = (appData.matches[group] || []).find(m => m.id === matchId);
    if (!match) return;

    match.fecha = newDate;
    saveData();
    populateAdminMatches();
    alert('¡Fecha y hora programadas con éxito (sin alterar resultados)!');
}

// GUARDAR SÓLO EL RESULTADO DE LA PARTIDA DE GRUPO
function saveMatchResultOnly() {
    const group = document.getElementById('admin-res-group').value;
    const matchId = document.getElementById('admin-res-match').value;
    const outcome = document.getElementById('admin-res-outcome').value;

    if (!matchId) {
        alert('Selecciona una partida válida.');
        return;
    }
    const match = (appData.matches[group] || []).find(m => m.id === matchId);
    if (!match) return;

    // Revertir puntuación anterior si ya se había jugado
    if (match.result) {
        const wSt = appData.students.find(s => s.id === match.whiteId);
        const bSt = appData.students.find(s => s.id === match.blackId);
        if (wSt && bSt) {
            wSt.pj--; bSt.pj--;
            if (match.result === 'WHITE') { wSt.g--; wSt.pts -= 1; bSt.p--; }
            else if (match.result === 'BLACK') { bSt.g--; bSt.pts -= 1; wSt.p--; }
            else if (match.result === 'DRAW') { wSt.e--; wSt.pts -= 0.5; bSt.e--; bSt.pts -= 0.5; }
        }
    }

    match.result = outcome;
    const whiteStudent = appData.students.find(s => s.id === match.whiteId);
    const blackStudent = appData.students.find(s => s.id === match.blackId);

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

    saveData();
    populateAdminMatches();
    alert('¡Resultado de la partida guardado y posiciones actualizadas!');
}

// GENERAR BRACKETS
function generateBrackets() {
    for (let gKey in appData.matches) {
        const matchesInGroup = appData.matches[gKey];
        for (let m of matchesInGroup) {
            if (!m.result) {
                alert(`Bloqueo activo: Hay partidas pendientes en el ${gKey}. Deben jugarse y registrarse todas las partidas antes de generar los octavos.`);
                return;
            }
        }
    }

    let qualified = [];
    for (let i = 1; i <= TOTAL_GROUPS; i++) {
        const gName = `Grupo ${String.fromCharCode(64 + i)}`;
        const gStudents = appData.students.filter(s => s.grupo === gName);
        gStudents.sort((a, b) => b.pts - a.pts);
        if (gStudents.length > 0) {
            qualified.push(`${gStudents[0].nombre} ${gStudents[0].apellido}`);
        }
    }

    if (qualified.length < 2) {
        alert('Se necesitan al menos 2 estudiantes clasificados para generar los brackets.');
        return;
    }

    appData.brackets.r16 = [];
    for (let i = 0; i < 8; i++) {
        appData.brackets.r16.push({
            id: `r16_${i}`,
            p1: qualified[i * 2] || 'Por definir',
            p2: qualified[i * 2 + 1] || 'Por definir',
            winner: null,
            fecha: ''
        });
    }

    appData.brackets.qf = [ {id:'qf_0', p1:'Ganador R16 #1', p2:'Ganador R16 #2', winner:null, fecha:''}, {id:'qf_1', p1:'Ganador R16 #3', p2:'Ganador R16 #4', winner:null, fecha:''}, {id:'qf_2', p1:'Ganador R16 #5', p2:'Ganador R16 #6', winner:null, fecha:''}, {id:'qf_3', p1:'Ganador R16 #7', p2:'Ganador R16 #8', winner:null, fecha:''} ];
    appData.brackets.sf = [ {id:'sf_0', p1:'Ganador QF #1', p2:'Ganador QF #2', winner:null, fecha:''}, {id:'sf_1', p1:'Ganador QF #3', p2:'Ganador QF #4', winner:null, fecha:''} ];
    appData.brackets.final = [ {id:'final_0', p1:'Ganador SF #1', p2:'Ganador SF #2', winner:null, fecha:''} ];

    saveData();
    renderBracketsView();
    populateBracketMatches();
    populateAdminBracketSchedule();
    alert('¡Fase de grupos completada! Octavos de Final generados.');
}

function populateBracketMatches() {
    const round = document.getElementById('admin-bracket-round').value;
    const matchSelect = document.getElementById('admin-bracket-match');
    if (!matchSelect) return;

    matchSelect.innerHTML = '';
    const matches = appData.brackets[round] || [];

    if (matches.length === 0) {
        matchSelect.innerHTML = `<option value="">Genera los brackets primero</option>`;
        return;
    }

    matches.forEach((m) => {
        const wText = m.winner ? ` [Ganador: ${m.winner}]` : '';
        matchSelect.innerHTML += `<option value="${m.id}">${m.p1} vs ${m.p2}${wText}</option>`;
    });
}

// ADMINISTRACIÓN DE FECHA Y GANADOR DE BRACKETS
function populateAdminBracketSchedule() {
    const round = document.getElementById('admin-bracket-sched-round').value;
    const matchSelect = document.getElementById('admin-bracket-sched-match');
    const dateInput = document.getElementById('admin-bracket-sched-date');
    if (!matchSelect || !dateInput) return;

    matchSelect.innerHTML = '';
    const matches = appData.brackets[round] || [];

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

function loadBracketDateToInput() {
    const round = document.getElementById('admin-bracket-sched-round').value;
    const matchId = document.getElementById('admin-bracket-sched-match').value;
    const dateInput = document.getElementById('admin-bracket-sched-date');
    if (!matchId || !dateInput) return;

    const match = (appData.brackets[round] || []).find(m => m.id === matchId);
    if (match && match.fecha) {
        dateInput.value = match.fecha;
    } else {
        dateInput.value = '';
    }
}

function saveBracketDate() {
    const round = document.getElementById('admin-bracket-sched-round').value;
    const matchId = document.getElementById('admin-bracket-sched-match').value;
    const newDate = document.getElementById('admin-bracket-sched-date').value;

    if (!matchId) {
        alert('Selecciona una llave válida.');
        return;
    }
    const match = (appData.brackets[round] || []).find(m => m.id === matchId);
    if (!match) return;

    match.fecha = newDate;
    saveData();
    populateAdminBracketSchedule();
    alert('¡Fecha y hora programadas para la llave de eliminación con éxito!');
}

function saveBracketWinner() {
    const round = document.getElementById('admin-bracket-round').value;
    const matchId = document.getElementById('admin-bracket-match').value;
    const winnerChoice = document.getElementById('admin-bracket-winner').value;

    if (!matchId) {
        alert('Selecciona una llave válida.');
        return;
    }

    const matches = appData.brackets[round] || [];
    const matchObj = matches.find(m => m.id === matchId);
    if (!matchObj) return;

    const winningName = winnerChoice === '1' ? matchObj.p1 : matchObj.p2;
    matchObj.winner = winningName;

    const matchIndex = matches.indexOf(matchObj);
    if (round === 'r16') {
        const qfIndex = Math.floor(matchIndex / 2);
        const qfMatch = appData.brackets.qf[qfIndex];
        if (qfMatch) {
            if (matchIndex % 2 === 0) qfMatch.p1 = winningName;
            else qfMatch.p2 = winningName;
        }
    } else if (round === 'qf') {
        const sfIndex = Math.floor(matchIndex / 2);
        const sfMatch = appData.brackets.sf[sfIndex];
        if (sfMatch) {
            if (matchIndex % 2 === 0) sfMatch.p1 = winningName;
            else sfMatch.p2 = winningName;
        }
    } else if (round === 'sf') {
        const finalMatch = appData.brackets.final[0];
        if (finalMatch) {
            if (matchIndex === 0) finalMatch.p1 = winningName;
            else finalMatch.p2 = winningName;
        }
    }

    saveData();
    renderBracketsView();
    populateBracketMatches();
    populateAdminBracketSchedule();
    alert(`¡Ganador guardado! ${winningName} avanza de ronda.`);
}

function renderBracketsView() {
    const r16Container = document.getElementById('bracket-r16');
    const qfContainer = document.getElementById('bracket-qf');
    const sfContainer = document.getElementById('bracket-sf');
    const finalContainer = document.getElementById('bracket-final');

    if (!r16Container) return;

    r16Container.innerHTML = '';
    (appData.brackets.r16 || []).forEach((m, idx) => {
        r16Container.innerHTML += `
            <div class="bg-chess-dark p-3 rounded-xl border border-chess-border text-xs space-y-1">
                <div class="text-gray-400 font-bold mb-1">Octavos #${idx + 1}</div>
                <div class="text-white px-2.5 py-1.5 rounded ${m.winner === m.p1 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-white px-2.5 py-1.5 rounded ${m.winner === m.p2 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });

    qfContainer.innerHTML = '';
    (appData.brackets.qf || []).forEach((m, idx) => {
        qfContainer.innerHTML += `
            <div class="bg-chess-dark p-3 rounded-xl border border-chess-border text-xs space-y-1">
                <div class="text-amber-400 font-bold mb-1">Cuartos #${idx + 1}</div>
                <div class="text-white px-2.5 py-1.5 rounded ${m.winner === m.p1 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-white px-2.5 py-1.5 rounded ${m.winner === m.p2 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });

    sfContainer.innerHTML = '';
    (appData.brackets.sf || []).forEach((m, idx) => {
        sfContainer.innerHTML += `
            <div class="bg-chess-dark p-3 rounded-xl border border-chess-border text-xs space-y-1">
                <div class="text-amber-400 font-bold mb-1">Semifinal #${idx + 1}</div>
                <div class="text-white px-2.5 py-1.5 rounded ${m.winner === m.p1 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-white px-2.5 py-1.5 rounded ${m.winner === m.p2 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });

    finalContainer.innerHTML = '';
    (appData.brackets.final || []).forEach((m) => {
        finalContainer.innerHTML += `
            <div class="bg-gradient-to-br from-amber-900/40 to-chess-dark p-4 rounded-xl border border-amber-500/40 text-xs space-y-2 text-center shadow-lg">
                <div class="text-amber-400 font-extrabold uppercase tracking-wide"><i class="fa-solid fa-crown mr-1"></i> Gran Final</div>
                <div class="text-white px-3 py-2 rounded font-semibold ${m.winner === m.p1 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p1}</div>
                <div class="text-gray-400 font-bold">VS</div>
                <div class="text-white px-3 py-2 rounded font-semibold ${m.winner === m.p2 ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'bg-chess-card'}">${m.p2}</div>
            </div>
        `;
    });
}

function renderAdminStudents() {
    const tbody = document.getElementById('admin-students-tbody');
    const countEl = document.getElementById('admin-student-count');
    if (!tbody) return;

    tbody.innerHTML = '';
    countEl.innerText = `Total: ${appData.students.length}`;

    if (appData.students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400">No hay estudiantes registrados.</td></tr>`;
        return;
    }

    appData.students.forEach(st => {
        tbody.innerHTML += `
            <tr class="hover:bg-chess-dark transition">
                <td class="p-3 font-semibold text-white">${st.nombre} ${st.apellido}</td>
                <td class="p-3 text-amber-400">${st.grupo}</td>
                <td class="p-3 text-center">
                    <button onclick="deleteStudent('${st.id}')" class="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-xs hover:bg-red-500/30 transition"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function updateStatCounters() {
    const statEl = document.getElementById('stat-students');
    if (statEl) statEl.innerText = appData.students.length;
}

// CARGA INICIAL
window.onload = function() {
    initGroupSelectors();
    updateStatCounters();
    renderGroups();
    renderSchedule();
    renderBracketsView();
};