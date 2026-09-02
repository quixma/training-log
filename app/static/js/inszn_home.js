//once html is loaded, get inital chart
document.addEventListener("DOMContentLoaded", () => {
    initializeChart();
    initializeThrowsBreakdownChart();
});

//get form elements for chart values
const metricSelect = document.getElementById('metric-select')
const timeframeSelect = document.getElementById('time-select')

//get drill row for drill notes
const drill_row = document.getElementById("drill-row");

//finds table row of throwing plan, id set in html to throwing plan id from db
var editTP_Btn = document.getElementById('editTP');
const rowTP = editTP_Btn.closest("tr");

//edit throwing plan button/modal
var modalTP = document.getElementById('editTP-modal')
var saveTP_Btn = document.getElementById('saveTP')

//player goals button/modal
var modalGoals = document.getElementById('editGoals-modal')
var editGoals_Btn = document.getElementById('editGoals')
var saveGoalsBtn = document.getElementById('saveGoals')

//throwing plan and notes labels
const throwingPlanSelect = document.getElementById('retrieve-throwing-plan');
const throwingNoteSelect = document.getElementById('retrieve-throwing-notes');
const throwingNoteTimeSelect = document.getElementById('throwing-notes-time');
const throwingDaySelect = document.getElementById('throwing-day-type');
const throwingDayTimeSelect = document.getElementById('throwing-day-time');
const gameNoteSelect = document.getElementById('retrieve-game-notes');
const playerGoalsSelect = document.getElementById('retrieve-player-goals');

//add event listeners
throwingPlanSelect.addEventListener("change", GetThrowingPlan);
throwingNoteSelect.addEventListener("change", GetThrowingNotes);
throwingNoteTimeSelect.addEventListener("change", GetThrowingNotes);
throwingDaySelect.addEventListener("change", GetThrowingNotesByDay);
throwingDayTimeSelect.addEventListener("change", GetThrowingNotesByDay);
gameNoteSelect.addEventListener("change", GetGameNotes);
playerGoalsSelect.addEventListener("change", GetPlayerGoals);

//chart event listeners
metricSelect.addEventListener("change", getData);
timeframeSelect.addEventListener("change", getData);

// Close buttons
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.modal).classList.remove('active');
    });
});
// Click outside to close
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('active');
    });
});

GetThrowingPlan();
GetThrowingNotes();
GetThrowingNotesByDay();
GetGameNotes();
GetPlayerGoals();
getData(); //chart api data


//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

editTP_Btn.onclick = function () { //edit throwing plan
    openModal('editTP-modal');

    //get modal text boxes to populate and update
    const throwing_sessions_modal = document.getElementById("throwing-days");
    const throwing_notes_modal = document.getElementById("throwing-notes");
    const pitching_notes_modal = document.getElementById("pitching-notes");
    const drill_notes_modal = document.getElementById("drill-notes");

    //gets current table values displayed in html
    const throwing_sessions = rowTP.children[1].innerText;
    const throwing_notes = rowTP.children[2].innerText;
    const pitching_notes = rowTP.children[3].innerText;
    const drill_notes = drill_row.children[0].innerText;

    //populates modal fields for editing
    throwing_sessions_modal.value = throwing_sessions;
    throwing_notes_modal.value = throwing_notes;
    pitching_notes_modal.value = pitching_notes;
    drill_notes_modal.value = drill_notes;
}

saveTP_Btn.onclick = function () {
    const updatedFormData = {
        throwing_planID: Number(rowTP.id),
        throwing_sessions: document.getElementById("throwing-days").value,
        throwing_notes: document.getElementById("throwing-notes").value,
        pitching_notes: document.getElementById("pitching-notes").value,
        drill_notes: document.getElementById("drill-notes").value
    }

    fetch('/api/updateThrowingPlan',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(updatedFormData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Update success:', data);
            modalTP.style.display = "none";
            window.location.reload();
        })
        .catch(error => {
            console.error('Update failed:', error);
            alert('Update failed. See console.');
        });
}

//player goals modal
editGoals_Btn.onclick = function () { //log new player plan goals
    openModal('editGoals-modal');

    //default date to today, clear prior entries so a new dated entry is created
    document.getElementById("goals-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("goals-pitching").value = "";
    document.getElementById("goals-arsenal").value = "";
    document.getElementById("goals-delivery").value = "";
    document.getElementById("goals-execution").value = "";
}

saveGoalsBtn.onclick = function () {
    const newGoals = {
        date: document.getElementById("goals-date").value,
        plan_type: document.getElementById("goals-plan-type").value,
        pitching: document.getElementById("goals-pitching").value,
        arsenal: document.getElementById("goals-arsenal").value,
        delivery: document.getElementById("goals-delivery").value,
        execution: document.getElementById("goals-execution").value
    }

    fetch('/api/addPlayerGoals',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(newGoals)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Save success:', data);
            modalGoals.style.display = "none";
            window.location.reload();
        })
        .catch(error => {
            console.error('Save failed:', error);
            alert('Save failed. See console.');
        });
}

async function GetPlayerGoals() {
    date = playerGoalsSelect.value;

    if (!date) {
        console.log("Enter a search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getPlayerGoals',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ date: date })
            });

        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        UpdatePlayerGoalsTable(data);
    }
}
function UpdatePlayerGoalsTable(data) {
    const table = document.getElementById('player_goals_body');
    const row = table.rows[0];

    row.cells[0].innerText = data["date"];
    row.cells[1].innerText = data["pitching"];
    row.cells[2].innerText = data["arsenal"];
    row.cells[3].innerText = data["delivery"];
    row.cells[4].innerText = data["execution"];
}

window.addEventListener('click', function (event) {
    if (event.target == modalGoals) {
        modalGoals.style.display = "none";
    }
    if (event.target == modalTP) {
        modalTP.style.display = "none";
    }
});

//updating and displaying game notes tab
async function GetGameNotes() {
    date = gameNoteSelect.value;
    if (!date) {
        console.log("Enter a search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getGameNotes',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(date)
            });

        // Check if response is ok before parsing, display to html
        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        UpdateGameNotesTable(data);
    }
}
function UpdateGameNotesTable(data) {
    const table = document.getElementById('game_notes_body');
    const row = table.rows[0];

    row.setAttribute("id", data[0]['id'])

    row.cells[0].innerHTML = data[0]['date'];
    row.cells[1].innerHTML = data[0]["opponent"];
    row.cells[2].innerHTML = data[0]["subjective_notes"];
    row.cells[3].innerHTML = data[0]["feel_notes"];
    row.cells[4].innerHTML = data[0]['delivery_notes'];
    row.cells[5].innerHTML = data[0]['mental_notes'];
    row.cells[6].innerHTML = data[0]["post_outing_notes"];

}

//updating and displaying throwing plan tab
async function GetThrowingPlan() { //update for pre throw as well.
    date = throwingPlanSelect.value;
    if (!date) {
        console.log("Enter a search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getInsznThrowingPlan',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(date)
            });

        // Check if response is ok before parsing, display to html
        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        tp = data.tp;
        dr = data.drills;
        pre = data.prethrow;
        dr_length = Object.keys(dr.drills).length; //gets num of drills in drill array
        pre_length = Object.keys(pre.drills).length
        UpdateThrowingPlanTable(tp, dr.drills, dr_length, pre.drills, pre_length) //dr.drills subarray of actual drills inside object passed back from flask
    }
}
function UpdateThrowingPlanTable(tp, dr, length, pre, pre_length) {
    const table = document.getElementById('throwing_plan_body');
    const drillTable = document.getElementById('drills_body');
    const drillNotesTable = document.getElementById('drill_notes_body');
    const prethrowTable = document.getElementById('prethrowdrills_body');
    const prethrowNotesTable = document.getElementById('prethrow_notes_body');

    const drillNotes_row = drillNotesTable.rows[0];
    const prethrowNotes_row = prethrowNotesTable.rows[0];
    const row = table.rows[0];

    rowTP.setAttribute('id', tp.id); //updates id of throwing plan table row to the currently displayed throwing plan, so if you edit an old one, routes update to correct throwing plan

    row.cells[0].innerText = tp["date"];
    row.cells[1].innerText = tp["throwing_sessions"];
    row.cells[2].innerText = tp['throwing_notes'];
    row.cells[3].innerText = tp['pitching_notes'];
    drillNotes_row.cells[0].innerText = tp['drill_notes'];
    prethrowNotes_row.cells[0].innerText = tp['prethrow_notes'];

    //if length > current amount of table rows, add the amount needed.
    table_rows = drillTable.rows.length;
    if (length > table_rows) { //if length > current amount of table rows, add the amount needed.
        rows_needed = length - table_rows;

        for (let i = 0; i < rows_needed; i++) {
            var new_row = drillTable.insertRow();
            var cell1 = new_row.insertCell(0);
            var cell2 = new_row.insertCell(1);
            var cell3 = new_row.insertCell(2);
        }
    }
    else if (length < table_rows) { //if length < current amount of tr, delete difference
        rows_to_del = table_rows - length;
        for (let i = 0; i < rows_to_del; i++) {
            drillTable.deleteRow(i);
        }
    }
    else {
        //continue, amount needed and current amount are equal
    }

    for (let i = 0; i < length; i++) { //populate drill cells
        const drill_row = drillTable.rows[i];
        drill_row.cells[0].innerText = dr[i]["drill_name"];
        drill_row.cells[1].innerText = dr[i]["drill_type"];
        drill_row.cells[2].innerText = dr[i]["throw_count"];
    }

    //pre throw table rows handling
    pre_table_rows = prethrowTable.rows.length;
    if (pre_length > pre_table_rows) { //if length > current amount of table rows, add the amount needed.
        rows_needed = pre_length - pre_table_rows;

        for (let i = 0; i < rows_needed; i++) {
            var new_row = prethrowTable.insertRow();
            var cell1 = new_row.insertCell(0);
            var cell2 = new_row.insertCell(1);
        }
    }
    else if (pre_length < pre_table_rows) { //if length < current amount of tr, delete difference
        rows_to_del = pre_table_rows - pre_length
        for (let i = 0; i < rows_to_del; i++) {
            prethrowTable.deleteRow(i);
        }
    }
    else {
        //continue, amount needed and current amount are equal
    }

    for (let i = 0; i < pre_length; i++) { //populate drill cells
        const pre_drill_row = prethrowTable.rows[i];
        pre_drill_row.cells[0].innerText = pre[i]["drill_name"];
        pre_drill_row.cells[1].innerText = pre[i]["drill_type"];
    }
}

//updating and displaying throwing notes tab
async function GetThrowingNotes() {
    const notes_data = {
        date: throwingNoteSelect.value,
        time: throwingNoteTimeSelect.value,
    }

    if (!notes_data.date || !notes_data.time) {
        console.log("Enter both search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getThrowingNotes',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(notes_data)
            });

        // Check if response is ok before parsing, display to html
        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        UpdateThrowingNotesTable(data, data.length);

    }
}
function UpdateThrowingNotesTable(data, length) {
    const notesTable = document.getElementById('throwing_notes_body');
    const table_rows = notesTable.rows.length;

    for (let i = 0; i < table_rows; i++) { //empty's table values before repopulating 
        for (let j = 0; j < 2; j++) {
            notesTable.rows[i].cells[j].innerText = '';
        }
    }
    if (length > table_rows) { //if length > amount of rows, add amount of difference
        rows_needed = length - table_rows;

        for (let i = 0; i < rows_needed; i++) {
            var new_row = notesTable.insertRow();
            var cell1 = new_row.insertCell(0);
            var cell2 = new_row.insertCell(1);
            var cell3 = new_row.insertCell(2);
            var cell4 = new_row.insertCell(3);
        }
    }
    else if (length < table_rows) { //len < rows, remove difference 
        rows_to_del = table_rows - length;
        for (let i = 0; i < rows_to_del; i++) {
            notesTable.deleteRow(-1); //-1 is deleting the last row in the table 
        }
    }
    else {
        //equal amount, continue
    }

    for (let i = 0; i < length; i++) { //update table
        const notesRow = notesTable.rows[i];

        notesRow.cells[0].innerHTML = data[i]['date'];
        notesRow.cells[1].innerHTML = data[i]['notes_html'];

    }

}
async function GetThrowingNotesByDay() {
    const notes_data = {
        day: throwingDaySelect.value,
        time: throwingDayTimeSelect.value,
    }

    if (!notes_data.day || !notes_data.time) {
        console.log("Enter both search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getThrowingNotesByDay',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(notes_data)
            });

        // Check if response is ok before parsing, display to html
        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        UpdateThrowingNotesTable(data, data.length);

    }
}

//Chart Section
async function getData() {
    const formData = {
        metric: metricSelect.value,
        time: timeframeSelect.value
    }

    if (!formData.metric || !formData.time) {
        console.log("Enter both search criteria")
        return;
    }
    else {
        const response = await fetch('/api/inszn_chart_data',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(formData)
            });

        // Check if response is ok before parsing, display to html
        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        console.log(data)
        updateChart(data)
    }
}

function updateChart(data) {
    clearCharts()
    metricMap = metricSelect.value;
    if (metricMap == "totalThrows7d") {
        label_dataX = data.date;
        label_dataY = data.totalThrows7d;
    }
    else {
        label_dataX = data.map(row => row.date);
        label_dataY = data.map(row => row[metricMap]);
    }

    const ctx = document.getElementById('chart').getContext('2d');
    updatedChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: label_dataX,
            datasets: [
                {
                    label: metricMap,
                    data: label_dataY,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true
        }
    });
}

function clearCharts() {
    if (typeof defaultChart !== 'undefined') {
        defaultChart.destroy()
    }
    if (typeof updatedChart !== 'undefined') {
        updatedChart.destroy()
    }
}

function initializeChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    defaultChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Metric",
                    data: [],
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true
        }
    });
}
function initializeChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    defaultChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Metric",
                    data: [],
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true
        }
    });
}

//stacked bar chart: last 7 throwing days broken into game / working set / other throws
function initializeThrowsBreakdownChart() {
    const dataEl = document.getElementById('throws-breakdown-data');
    const breakdown = JSON.parse(dataEl.textContent);

    const ctx = document.getElementById('throwsBreakdownChart').getContext('2d');
    throwsBreakdownChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: breakdown.map(d => d.date),
            datasets: [
                {
                    label: 'Game Throws',
                    data: breakdown.map(d => d.game_throws),
                    backgroundColor: '#e8383b'
                },
                {
                    label: 'Working Set Throws',
                    data: breakdown.map(d => d.working_set_throws),
                    backgroundColor: '#f59e0b'
                },
                {
                    label: 'Regular Throws',
                    data: breakdown.map(d => d.other_throws),
                    backgroundColor: '#7b82a0'
                },
                {
                    label: 'Non-Baseball Throws',
                    data: breakdown.map(d => d.non_baseball_throws),
                    backgroundColor: '#22c55e'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: 'Throw Count' }
                }
            }
        }
    });

    UpdateThrowsBreakdownStats(breakdown);
}

function UpdateThrowsBreakdownStats(breakdown) {
    const gameThrows7d = breakdown.reduce((sum, d) => sum + d.game_throws, 0);
    const workingSetThrows7d = breakdown.reduce((sum, d) => sum + d.working_set_throws, 0);
    const nonBaseballThrows7d = breakdown.reduce((sum, d) => sum + d.non_baseball_throws, 0);
    //baseball-only total: non-baseball throws are tracked separately and never count toward total throws
    const totalThrows7d = breakdown.reduce((sum, d) => sum + d.game_throws + d.working_set_throws + d.other_throws, 0);

    const statsEl = document.getElementById('throwsBreakdownStats');
    statsEl.innerHTML = `
        <div class="stat-item"><span class="stat-label">Total (7d)</span><span class="stat-value">${totalThrows7d}</span></div>
        <div class="stat-item"><span class="stat-label">Working Set (7d)</span><span class="stat-value">${workingSetThrows7d}</span></div>
        <div class="stat-item"><span class="stat-label">Game (7d)</span><span class="stat-value">${gameThrows7d}</span></div>
        <div class="stat-item"><span class="stat-label">Non-Baseball (7d)</span><span class="stat-value">${nonBaseballThrows7d}</span></div>
    `;
}

