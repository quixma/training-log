
//initialize drop down menu selectors
const playerGoalsSelect = document.getElementById('retrieve-player-goals')
const bodyNotesSelect = document.getElementById('retrieve-body-notes')
const bodyNotesTimeSelect = document.getElementById('body-notes-time')

//player goals button/modal
var modalGoals = document.getElementById('editGoals-modal')
var editGoals_Btn = document.getElementById('editGoals')
var saveGoalsBtn = document.getElementById('saveGoals')
var rowWkoutGoals = document.getElementById('goals-data-row');

//add event listeners to query on change
playerGoalsSelect.addEventListener("change", GetPlayerGoals);
bodyNotesSelect.addEventListener("change", GetBodyNotes);
bodyNotesTimeSelect.addEventListener("change", GetBodyNotes);

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

GetPlayerGoals();

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

//-----------Player goals functions ---------------
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
                body: JSON.stringify({ plan_type: "workout", date: date })
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
    row.cells[1].innerText = data["gym"];
    row.cells[2].innerText = data["back"];
    row.cells[3].innerText = data["nutrition"];
}

window.addEventListener('click', function (event) {
    if (event.target == modalGoals) {
        modalGoals.style.display = "none";
    }
});


editGoals_Btn.onclick = function () { //log new player plan goals
    openModal('editGoals-modal');

    //default date to today, clear prior entries so a new dated entry is created
    document.getElementById("goals-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("goals-gym").value = rowWkoutGoals.children[1].innerText; //shows current goals in modal
    document.getElementById("goals-back").value = rowWkoutGoals.children[2].innerText;
    document.getElementById("goals-nutrition").value = rowWkoutGoals.children[3].innerText;
}

saveGoalsBtn.onclick = function () {
    const newGoals = {
        date: document.getElementById("goals-date").value,
        plan_type: "workout", //this dashboard owns the workout goals
        gym: document.getElementById("goals-gym").value,
        back: document.getElementById("goals-back").value,
        nutrition: document.getElementById("goals-nutrition").value
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

//-----------body notes functions---------------
//body notes: a date anchors the lookup and the range picks how many notes back from it
async function GetBodyNotes() {
    const notes_data = {
        date: bodyNotesSelect.value,
        time: bodyNotesTimeSelect.value,
    }

    if (!notes_data.date || !notes_data.time) {
        console.log("Enter both search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getBodyNotes',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(notes_data)
            });

        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        UpdateBodyNotesTable(data);
    }
}

function UpdateBodyNotesTable(data) {
    const tbody = document.getElementById('bodynotes_body');

    tbody.innerHTML = "";
    data.forEach(note => {
        const row = tbody.insertRow();
        addCell(row, "Date").textContent = note["Date"];
        addCell(row, "Body Notes").innerHTML = note["body_notes"]; //pre-formatted with <br> by the backend
    });
}


//cells built here have to carry the same data-label the template renders, since the
//mobile layout turns those labels into each row's headings
function addCell(row, label) {
    const cell = row.insertCell();
    cell.setAttribute('data-label', label);
    return cell;
}
