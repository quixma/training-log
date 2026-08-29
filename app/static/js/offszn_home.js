//getting edit throwing plan buttons/modal
var modalTP = document.getElementById('editTP-modal')
var editTP_Btn = document.getElementById('editTP')
var saveTP_Btn = document.getElementById('saveTP')

//get drill row for drill notes
const drill_row = document.getElementById("drill-row")

//finds table row of throwing plan, id set in html to throwing plan id from db
const rowTP = editTP_Btn.closest("tr");

//edit throwing notes buttons/modal
var modalNotes = document.getElementById('editNotes-modal')
var saveNotesBtn = document.getElementById('saveNotes')

//player goals button/modal
var modalGoals = document.getElementById('editGoals-modal')
var editGoals_Btn = document.getElementById('editGoals')
var saveGoalsBtn = document.getElementById('saveGoals')

//throwing plan and notes labels
const throwingPlanSelect = document.getElementById('retrieve-throwing-plan')
const throwingNoteSelect = document.getElementById('retrieve-throwing-notes')
const throwingNoteTimeSelect = document.getElementById('throwing-notes-time')
const throwingDaySelect = document.getElementById('throwing-day-type')
const throwingDayTimeSelect = document.getElementById('throwing-day-time')
const playerGoalsSelect = document.getElementById('retrieve-player-goals')

//add event listeners
throwingPlanSelect.addEventListener("change", GetThrowingPlan);
throwingNoteSelect.addEventListener("change", GetThrowingNotes);
throwingNoteTimeSelect.addEventListener("change", GetThrowingNotes);
throwingDaySelect.addEventListener("change", GetThrowingNotesByDay);
throwingDayTimeSelect.addEventListener("change", GetThrowingNotesByDay);
playerGoalsSelect.addEventListener("change", GetPlayerGoals);


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
GetPlayerGoals();

//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// Open helpers — call these from index.js or inline
// openModal('editTP-modal') / openModal('editNotes-modal')
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

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
                body: JSON.stringify({ plan_type: "offszn", date: date })
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

editTP_Btn.onclick = function () { //edit throwing plan
    //did it this way first time to understand the routes, simplified in other modals
    openModal('editTP-modal');

    //get modal text boxes to populate and update
    const num_throwing_days_modal = document.getElementById("num-throwing-days");
    const throwing_sessions_modal = document.getElementById("throwing-days");
    const throwing_notes_modal = document.getElementById("throwing-notes");
    const pitching_notes_modal = document.getElementById("pitching-notes");
    const drill_notes_modal = document.getElementById("drill-notes");

    //gets current table values displayed in html
    const throwing_days = rowTP.children[2].innerText;
    const throwing_sessions = rowTP.children[3].innerText;
    const throwing_notes = rowTP.children[4].innerText;
    const pitching_notes = rowTP.children[5].innerText;
    const drill_notes = drill_row.children[0].innerText;

    //populates modal fields for editing
    num_throwing_days_modal.value = throwing_days;
    throwing_sessions_modal.value = throwing_sessions;
    throwing_notes_modal.value = throwing_notes;
    pitching_notes_modal.value = pitching_notes;
    drill_notes_modal.value = drill_notes;
}


saveTP_Btn.onclick = function () {
    console.log(rowTP.id);
    const updatedFormData = { //gets updated values, id for which db row to update
        throwing_planID: Number(rowTP.id), //html id of the throwing plan from db
        num_throwing_days: Number(document.getElementById("num-throwing-days").value),
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

async function GetThrowingPlan() {
    date = throwingPlanSelect.value;
    if (!date) {
        console.log("Enter a search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getThrowingPlan',
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
        length = Object.keys(dr.drills).length; //gets num of drills in drill array 
        UpdateThrowingPlanTable(tp, dr.drills, length) //dr.drills subarray of actual drills inside object passed back from flask
    }
}
function UpdateThrowingPlanTable(tp, dr, length) {
    const table = document.getElementById('throwing_plan_body');
    const drillTable = document.getElementById('drills_body');
    const drillNotesTable = document.getElementById('drill_notes_body');

    const drillNotes_row = drillNotesTable.rows[0];
    const row = table.rows[0];

    rowTP.setAttribute('id', tp.id); //updates id of throwing plan table row to the currently displayed throwing plan, so if you edit an old one, routes update to correct throwing plan

    row.cells[0].innerText = tp["date"];
    row.cells[1].innerText = tp["throwing_block"];
    row.cells[2].innerText = tp["num_throwing_days"];
    row.cells[3].innerText = tp["throwing_sessions"];
    row.cells[4].innerText = tp['throwing_notes'];
    row.cells[5].innerText = tp['pitching_notes'];
    drillNotes_row.cells[0].innerText = tp['drill_notes'];

    //if length > current amount of table rows, add the amount needed.
    table_rows = drillTable.rows.length;
    if (length > table_rows) { //if length > current amount of table rows, add the amount needed.
        rows_needed = length - table_rows;

        for (let i = 0; i < rows_needed; i++) {
            var new_row = drillTable.insertRow();
            var cell1 = new_row.insertCell(0);
            var cell2 = new_row.insertCell(1);
            var cell3 = new_row.insertCell(2);
            var cell4 = new_row.insertCell(3);
        }
    }
    else if (length < table_rows) { //if length < current amount of tr, delete difference
        for (let i = length; i <= table_rows; i++) {
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
        drill_row.cells[2].innerText = dr[i]["ball_weight"];
        drill_row.cells[3].innerText = dr[i]["throw_count"];
    }

}

//edit throwing notes
//select all buttons by class, then populate modal based on which throwing notes row is clicked
document.querySelectorAll(".editNotes").forEach(btn => {
    btn.onclick = function () {

        openModal('editNotes-modal')

        const rowNotes = btn.closest("tr"); //gets id (of throwing session notes) of closest row to button clicked
        const session_id_notes = rowNotes.id;
        modalNotes.dataset.sessionID = session_id_notes; //saves sessionID for save btn to access

        //populate modal with values from get_throwing_notes(), based on id of throwing session
        document.getElementById("edit-modal-date").value = rowNotes.children[0].innerText;
        document.getElementById('throwing_notes').value = rowNotes.children[1].innerText;
    };
});

saveNotesBtn.onclick = function () {
    const updatedNotes = {
        notesID: Number(modalNotes.dataset.sessionID),
        date: document.getElementById("edit-modal-date").value,
        throwing_notes: document.getElementById("throwing_notes").value //get updated notes
    }

    fetch('/api/updateNotes',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(updatedNotes)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Update success:', data);
            modalNotes.style.display = "none";
            window.location.reload();
        })
        .catch(error => {
            console.error('Update failed:', error);
            alert('Update failed. See console.');
        });
}
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

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
    if (event.target == modalTP) {
        modalTP.style.display = "none";
    }
    if (event.target == modalNotes) {
        modalNotes.style.display = "none";
    }
    if (event.target == modalGoals) {
        modalGoals.style.display = "none";
    }

} 