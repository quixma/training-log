//once html is loaded, get inital chart
document.addEventListener("DOMContentLoaded", () => {
    initializeChart();
});

//get form elements for chart values
const metricSelect = document.getElementById('metric-select')
const timeframeSelect = document.getElementById('time-select')

//get drill row for drill notes
const drill_row = document.getElementById("drill-row");

//finds table row of throwing plan, id set in html to throwing plan id from db
var editTP_Btn = document.getElementById('editTP');
const rowTP = editTP_Btn.closest("tr");

//throwing plan and notes labels
const throwingPlanSelect = document.getElementById('retrieve-throwing-plan');
const throwingNoteSelect = document.getElementById('retrieve-throwing-notes');
const throwingNoteTimeSelect = document.getElementById('throwing-notes-time');
const throwingDaySelect = document.getElementById('throwing-day-type');
const throwingDayTimeSelect = document.getElementById('throwing-day-time');
const gameNoteSelect = document.getElementById('retrieve-game-notes');

//add event listeners
throwingPlanSelect.addEventListener("change", GetThrowingPlan);
throwingNoteSelect.addEventListener("change", GetThrowingNotes);
throwingNoteTimeSelect.addEventListener("change", GetThrowingNotes);
throwingDaySelect.addEventListener("change", GetThrowingNotesByDay);
throwingDayTimeSelect.addEventListener("change", GetThrowingNotesByDay);
gameNoteSelect.addEventListener("change", GetGameNotes);
//chart event listeners
metricSelect.addEventListener("change", getData);
timeframeSelect.addEventListener("change", getData);

GetThrowingPlan();
GetThrowingNotes();
GetThrowingNotesByDay();
GetGameNotes();
getData(); //chart api data


//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

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
    row.cells[4].innerHTML = data[0]['mental_notes'];
    row.cells[5].innerHTML = data[0]['good_bad_notes'];
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

