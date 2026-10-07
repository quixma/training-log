//once html is loaded, get inital chart
document.addEventListener("DOMContentLoaded", () => {
    initializeChart();
    initializeThrowsBreakdownChart();

    //rotating the phone crosses the breakpoint, and Chart.js merges its defaults in at
    //construction, so both charts are rebuilt rather than handed a fresh options object
    PitchCharts.onWidthChange(() => {
        if (typeof throwsBreakdownChart !== 'undefined' && throwsBreakdownChart) {
            throwsBreakdownChart.destroy();
        }
        initializeThrowsBreakdownChart();
        rebuildMetricChart();
    });
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
var rowPlayerGoals = document.getElementById("goals-data-row");

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

//-------------PLAYER GOALS  FUNCTIONS-------------
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
                body: JSON.stringify({ plan_type: "pitching", date: date })
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
    row.cells[1].innerHTML = data["pitching_html"]; //pre-formatted with <br> by the backend
    row.cells[2].innerHTML = data["arsenal_html"];
    row.cells[3].innerHTML = data["delivery_html"];
    row.cells[4].innerHTML = data["execution_html"];
    //keep the raw copies in step, so the modal prefills with what was typed
    row.dataset.pitching = data["pitching"];
    row.dataset.arsenal = data["arsenal"];
    row.dataset.delivery = data["delivery"];
    row.dataset.execution = data["execution"];
}

window.addEventListener('click', function (event) {
    if (event.target == modalGoals) {
        modalGoals.style.display = "none";
    }
    if (event.target == modalTP) {
        modalTP.style.display = "none";
    }
});
editGoals_Btn.onclick = function () { //log new player plan goals
    openModal('editGoals-modal');

    //default date to today, clear prior entries so a new dated entry is created
    document.getElementById("goals-date").value = new Date().toISOString().split('T')[0];
    //the raw copies, not the cells: reading the rendered <br> text back would inject
    //newlines into the textarea and compound them on every save
    document.getElementById("goals-pitching").value = rowPlayerGoals.dataset.pitching || "";
    document.getElementById("goals-arsenal").value = rowPlayerGoals.dataset.arsenal || "";
    document.getElementById("goals-delivery").value = rowPlayerGoals.dataset.delivery || "";
    document.getElementById("goals-execution").value = rowPlayerGoals.dataset.execution || "";
}

saveGoalsBtn.onclick = function () {
    const newGoals = {
        date: document.getElementById("goals-date").value,
        plan_type: "pitching", //this dashboard owns the pitching goals; workout goals have their own page
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

//-------------THROWING PLAN FUNCTIONS-------------
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
        UpdateThrowingPlanTable(tp, dr.drills, pre.drills) //dr.drills subarray of actual drills inside object passed back from flask
    }
}
function UpdateThrowingPlanTable(tp, dr, pre) {
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
    row.cells[4].innerText = tp['mental_notes'];
    drillNotes_row.cells[0].innerText = tp['drill_notes'];
    prethrowNotes_row.cells[0].innerText = tp['prethrow_notes'];

    drillTable.innerHTML = "";
    dr.forEach(dr => {
        const row = drillTable.insertRow();
        addCell(row, "Drill Name").innerText = dr.drill_name;
        addCell(row, "Drill Type").innerText = dr.drill_type;
        addCell(row, "Throw Count").innerText = dr.throw_count;
    })

    prethrowTable.innerHTML = "";
    pre.forEach(pre => {
        const row = prethrowTable.insertRow();
        addCell(row, "Drill Name").innerText = pre.drill_name;
        addCell(row, "Drill Type").innerText = pre.drill_type;
    })
}
editTP_Btn.onclick = function () { //edit throwing plan
    openModal('editTP-modal');

    //get modal text boxes to populate and update
    const throwing_sessions_modal = document.getElementById("throwing-days");
    const throwing_notes_modal = document.getElementById("throwing-notes");
    const pitching_notes_modal = document.getElementById("pitching-notes");
    const mental_notes_modal = document.getElementById("mental-notes");
    const drill_notes_modal = document.getElementById("drill-notes");

    //gets current table values displayed in html
    const throwing_sessions = rowTP.children[1].innerText;
    const throwing_notes = rowTP.children[2].innerText;
    const pitching_notes = rowTP.children[3].innerText;
    const mental_notes = rowTP.children[4].innerText;
    const drill_notes = drill_row.children[0].innerText;

    //populates modal fields for editing
    throwing_sessions_modal.value = throwing_sessions;
    throwing_notes_modal.value = throwing_notes;
    pitching_notes_modal.value = pitching_notes;
    mental_notes_modal.value = mental_notes;
    drill_notes_modal.value = drill_notes;
}

saveTP_Btn.onclick = function () {
    const updatedFormData = {
        throwing_planID: Number(rowTP.id),
        throwing_sessions: document.getElementById("throwing-days").value,
        throwing_notes: document.getElementById("throwing-notes").value,
        pitching_notes: document.getElementById("pitching-notes").value,
        mental_notes: document.getElementById("mental-notes").value,
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


//----------GAME NOTES FUNCTIONS-----------
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

//-----------THROWING NOTES FUNCTIONS---------
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
        UpdateThrowingNotesTable(data);

    }
}
function UpdateThrowingNotesTable(data) {
    const notesTable = document.getElementById('throwing_notes_body');
    const table_rows = notesTable.rows.length;

    notesTable.innerHTML = "";
    data.forEach(data => {
        const row = notesTable.insertRow();
        addCell(row, "Date").innerHTML = data.date;
        addCell(row, "NOtes").innerHTML = data.notes_html;
    })

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

//cells built here have to carry the same data-label the template renders, since the
//mobile layout turns those labels into each row's headings
function addCell(row, label) {
    const cell = row.insertCell();
    cell.setAttribute('data-label', label);
    return cell;
}

//---------CHART FUNCTIONS------------
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
    else if (metricMap == "body_weight") {
        label_dataX = data.date;
        label_dataY = data.body_weight;
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
                    borderWidth: 2,
                    borderColor: PitchCharts.series(0),
                    backgroundColor: PitchCharts.series(0),
                    pointRadius: 2
                }
            ]
        },
        options: metricChartOptions(PitchCharts.isNarrow())
    });
}

//the metric chart is whatever the selects last asked for, so crossing the breakpoint
//re-renders the series on screen rather than dropping back to the empty default
function rebuildMetricChart() {
    const live = (typeof updatedChart !== 'undefined' && updatedChart) ? updatedChart
               : (typeof defaultChart !== 'undefined' ? defaultChart : null);
    if (!live) return;

    const type = live.config.type;
    const data = { labels: live.data.labels, datasets: live.data.datasets };
    clearCharts();

    const ctx = document.getElementById('chart').getContext('2d');
    updatedChart = new Chart(ctx, {
        type: type,
        data: data,
        options: metricChartOptions(PitchCharts.isNarrow())
    });
}

function clearCharts() {
    if (typeof defaultChart !== 'undefined' && defaultChart) {
        defaultChart.destroy()
        defaultChart = null
    }
    if (typeof updatedChart !== 'undefined' && updatedChart) {
        updatedChart.destroy()
        updatedChart = null
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
                    borderWidth: 2,
                    borderColor: PitchCharts.series(0),
                    backgroundColor: PitchCharts.series(0),
                    pointRadius: 2
                }
            ]
        },
        options: metricChartOptions(PitchCharts.isNarrow())
    });
}

function throwsBreakdownOptions(isNarrow) {
    return {
        responsive: true,
        aspectRatio: PitchCharts.plotAspect(isNarrow),
        plugins: { legend: PitchCharts.compactLegend(isNarrow) },
        scales: {
            x: {
                stacked: true,
                //a fixed seven-day window, so every day keeps its label
                ticks: PitchCharts.dateTicks(isNarrow, false)
            },
            y: {
                stacked: true,
                beginAtZero: true,
                //the axis title costs width the bars need more than the reader needs the word
                title: { display: !isNarrow, text: 'Throw Count' },
                ticks: PitchCharts.valueTicks(isNarrow)
            }
        }
    };
}

//the metric chart plots whatever range the selects ask for, so its axis has to be
//allowed to thin itself out rather than promise every date a label
function metricChartOptions(isNarrow) {
    return {
        responsive: true,
        aspectRatio: PitchCharts.plotAspect(isNarrow),
        plugins: { legend: PitchCharts.compactLegend(isNarrow) },
        scales: {
            x: { ticks: PitchCharts.dateTicks(isNarrow, true) },
            y: { ticks: PitchCharts.valueTicks(isNarrow) }
        }
    };
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
                    ...PitchCharts.stackedBarSpec(0, '#ffffff')
                },
                {
                    label: 'Working Set Throws',
                    data: breakdown.map(d => d.working_set_throws),
                    ...PitchCharts.stackedBarSpec(1, '#ffffff')
                },
                {
                    label: 'Regular Throws',
                    data: breakdown.map(d => d.other_throws),
                    ...PitchCharts.stackedBarSpec(2, '#ffffff')
                },
                {
                    label: 'Non-Baseball Throws',
                    data: breakdown.map(d => d.non_baseball_throws),
                    ...PitchCharts.stackedBarSpec(3, '#ffffff')
                }
            ]
        },
        options: throwsBreakdownOptions(PitchCharts.isNarrow())
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

