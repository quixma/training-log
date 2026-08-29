
//initialize drop down menu selectors
const warmupSelect = document.getElementById('retrieve-warmup')
const armcareSelect = document.getElementById('retrieve-armcare')
const spineSelect = document.getElementById('retrieve-spine')
const liftSelect = document.getElementById('retrieve-lift')
const conditioningSelect = document.getElementById('retrieve-conditioning')
const playerGoalsSelect = document.getElementById('retrieve-player-goals')

//player goals button/modal
var modalGoals = document.getElementById('editGoals-modal')
var editGoals_Btn = document.getElementById('editGoals')
var saveGoalsBtn = document.getElementById('saveGoals')

//add event listeners to query on change
warmupSelect.addEventListener("change", () => GetSelectedWorkout('warmup'));
armcareSelect.addEventListener("change", () => GetSelectedWorkout('armcare'));
spineSelect.addEventListener("change", () => GetSelectedWorkout('back'));
liftSelect.addEventListener("change", () => GetSelectedWorkout('lift'));
conditioningSelect.addEventListener("change", () => GetSelectedWorkout('conditioning'));
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

editGoals_Btn.onclick = function () { //log new player plan goals
    openModal('editGoals-modal');

    //default date to today, clear prior entries so a new dated entry is created
    document.getElementById("goals-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("goals-gym").value = "";
    document.getElementById("goals-back").value = "";
    document.getElementById("goals-nutrition").value = "";
}

saveGoalsBtn.onclick = function () {
    const newGoals = {
        date: document.getElementById("goals-date").value,
        plan_type: document.getElementById("goals-plan-type").value,
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


async function GetSelectedWorkout(tabName) {
    //get tab name for table, select correct value from the list correlated with tabName
    const selects = { warmup: warmupSelect, armcare: armcareSelect, back: spineSelect, lift: liftSelect, conditioning: conditioningSelect };
    const data = { type: tabName, value: selects[tabName].value };

    if (!data.value) {
        console.log("Enter a search criteria")
        return;
    }
    else {
        const response = await fetch('/api/getSelectedWorkout',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(data)
            });

        // Check if response is ok before parsing, display to html
        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const result = await response.json();

        if (tabName === "warmup") {
            UpdateWarmupTable(result);
        }
        else {
            UpdateExerciseTable(tabName, result);
        }
    }
}

//tab name -> ids of the elements that need to be updated for that tab
const EXERCISE_TABLES = {
    armcare: { tabId: 'armcare_workouts', tbodyId: 'armcare_body' },
    back: { tabId: 'back_workouts', tbodyId: 'spine_body' },
    lift: { tabId: 'lifts_workouts', tbodyId: 'lift_body' },
    conditioning: { tabId: 'conditioning_workouts', tbodyId: 'conditioning_body' },
};

//shared shape across armcare/back/lift/conditioning: {workout_name, notes, exercises: [{ex_block, ex_name, sets_reps, ex_notes}, ...]}
function UpdateExerciseTable(tabName, data) {
    const config = EXERCISE_TABLES[tabName];
    const tbody = document.getElementById(config.tbodyId);
    const metaSpan = document.querySelector(`#${config.tabId} .workout-meta`);

    if (metaSpan) {
        metaSpan.textContent = data.workout_name || "";
    }

    tbody.innerHTML = "";
    data.exercises.forEach(ex => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = ex.ex_block;
        row.insertCell(1).textContent = ex.ex_name;
        row.insertCell(2).textContent = ex.sets_reps;
        row.insertCell(3).innerHTML = ex.ex_notes; //pre-formatted with <br> by the backend
    });
}

//warmup shape is one row of exercise-category columns, not a list of exercises
function UpdateWarmupTable(data) {
    const tbody = document.getElementById('warmups_body');
    tbody.innerHTML = "";

    const row = tbody.insertRow();
    row.insertCell(0).textContent = data.name;
    row.insertCell(1).innerHTML = data.rollout_ex;
    row.insertCell(2).innerHTML = data.spine_ex;
    row.insertCell(3).innerHTML = data.hip_ex;
    row.insertCell(4).innerHTML = data.shoulder_ex;
    row.insertCell(5).innerHTML = data.arm_ex;
    row.insertCell(6).innerHTML = data.dynamic_ex;
    row.insertCell(7).innerHTML = data.notes;
}