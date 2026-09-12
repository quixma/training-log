
//initialize drop down menu selectors
const warmupSelect = document.getElementById('retrieve-warmup')
const workoutTypeSelect = document.getElementById('retrieve-workout-type')
const workoutSelect = document.getElementById('retrieve-workout')
const playerGoalsSelect = document.getElementById('retrieve-player-goals')
const bodyNotesSelect = document.getElementById('retrieve-body-notes')
const bodyNotesTimeSelect = document.getElementById('body-notes-time')

//player goals button/modal
var modalGoals = document.getElementById('editGoals-modal')
var editGoals_Btn = document.getElementById('editGoals')
var saveGoalsBtn = document.getElementById('saveGoals')
var rowWkoutGoals = document.getElementById('goals-data-row');

//edit modals for the workout and warmup currently on screen. the cards carry the record's
//id in data-record-id, refreshed whenever the tables swap in a different record
const workoutCard = document.getElementById('workout-card')
const warmupCard = document.getElementById('warmup-card')
const editWorkoutBtn = document.getElementById('editWorkout')
const editWarmupBtn = document.getElementById('editWarmup')
const saveWorkoutBtn = document.getElementById('saveWorkout')
const saveWarmupBtn = document.getElementById('saveWarmup')
const deleteWorkoutBtn = document.getElementById('deleteWorkout')
const deleteWarmupBtn = document.getElementById('deleteWarmup')

//pairs each exercise row field with its key in the workout payload
const EXERCISE_FIELDS = {
    '.row-ex-block': 'ex_block',
    '.row-ex-name': 'ex_name',
    '.row-sets-reps': 'sets_reps',
    '.row-ex-notes': 'ex_notes',
}

//add event listeners to query on change
warmupSelect.addEventListener("change", () => GetSelectedWorkout('warmup'));
workoutTypeSelect.addEventListener("change", GetWorkoutsByType);
workoutSelect.addEventListener("change", () => GetSelectedWorkout(workoutTypeSelect.value));
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
syncEditButton(editWorkoutBtn, workoutCard);
syncEditButton(editWarmupBtn, warmupCard);

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

//── edit the workout on screen ───────────────────────────────────────────
editWorkoutBtn.onclick = async function () {
    const record = await fetchRecordForEdit('workout', workoutCard.dataset.recordId);
    if (!record) {
        return;
    }

    document.getElementById("edit-workout-date").value = record.date;
    document.getElementById("edit-workout-type").value = record.workout_type;
    document.getElementById("edit-workout-name").value = record.workout_name;
    document.getElementById("edit-workout-notes").value = record.notes;
    fillModalRows('edit-ex-rows', 'ex-row-template', record.exercises, EXERCISE_FIELDS);

    openModal('editWorkout-modal');
}

document.getElementById('addExRow').onclick = () => addModalRow('edit-ex-rows', 'ex-row-template');
document.getElementById('removeExRow').onclick = () => removeModalRow('edit-ex-rows');

saveWorkoutBtn.onclick = function () {
    const updatedWorkout = {
        id: Number(workoutCard.dataset.recordId),
        date: document.getElementById("edit-workout-date").value,
        workout_type: document.getElementById("edit-workout-type").value,
        workout_name: document.getElementById("edit-workout-name").value,
        notes: document.getElementById("edit-workout-notes").value,
        exercises: readModalRows('edit-ex-rows', EXERCISE_FIELDS)
    }

    submitRecordChange('/api/updateWorkout', updatedWorkout, 'Update failed.');
}

deleteWorkoutBtn.onclick = function () {
    if (!confirm("Delete this workout and its exercises? This cannot be undone.")) {
        return;
    }

    submitRecordChange('/api/deleteRecord',
        { record_type: 'workout', id: Number(workoutCard.dataset.recordId) }, 'Delete failed.');
}

//── edit the warmup on screen ────────────────────────────────────────────
editWarmupBtn.onclick = async function () {
    const record = await fetchRecordForEdit('warmup', warmupCard.dataset.recordId);
    if (!record) {
        return;
    }

    document.getElementById("edit-warmup-date").value = record.date;
    document.getElementById("edit-warmup-name").value = record.name;
    document.getElementById("edit-warmup-rollout").value = record.rollout_ex;
    document.getElementById("edit-warmup-spine").value = record.spine_ex;
    document.getElementById("edit-warmup-hip").value = record.hip_ex;
    document.getElementById("edit-warmup-shoulder").value = record.shoulder_ex;
    document.getElementById("edit-warmup-arm").value = record.arm_ex;
    document.getElementById("edit-warmup-dynamic").value = record.dynamic_ex;
    document.getElementById("edit-warmup-notes").value = record.notes;

    openModal('editWarmup-modal');
}

saveWarmupBtn.onclick = function () {
    const updatedWarmup = {
        id: Number(warmupCard.dataset.recordId),
        date: document.getElementById("edit-warmup-date").value,
        name: document.getElementById("edit-warmup-name").value,
        rollout_ex: document.getElementById("edit-warmup-rollout").value,
        spine_ex: document.getElementById("edit-warmup-spine").value,
        hip_ex: document.getElementById("edit-warmup-hip").value,
        shoulder_ex: document.getElementById("edit-warmup-shoulder").value,
        arm_ex: document.getElementById("edit-warmup-arm").value,
        dynamic_ex: document.getElementById("edit-warmup-dynamic").value,
        notes: document.getElementById("edit-warmup-notes").value
    }

    submitRecordChange('/api/updateWarmup', updatedWarmup, 'Update failed.');
}

deleteWarmupBtn.onclick = function () {
    if (!confirm("Delete this warmup? This cannot be undone.")) {
        return;
    }

    submitRecordChange('/api/deleteRecord',
        { record_type: 'warmup', id: Number(warmupCard.dataset.recordId) }, 'Delete failed.');
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


//tabName is 'warmup' or a workout_type value ('Lift', 'Back/Core', ...)
async function GetSelectedWorkout(tabName) {
    const select = tabName === 'warmup' ? warmupSelect : workoutSelect;
    const data = { type: tabName, value: select.value };

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
            UpdateExerciseTable(result);
        }
    }
}

//switching workout type swaps in that type's name list and its most recent workout
async function GetWorkoutsByType() {
    const response = await fetch('/api/getWorkoutsByType',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ type: workoutTypeSelect.value })
        });

    if (!response.ok) {
        console.log('Update failed:', await response.text());
        alert('Update failed. See console.');
        return;
    }

    const result = await response.json();

    workoutSelect.innerHTML = '<option value="">Select Workout to View</option>';
    result.names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        workoutSelect.appendChild(option);
    });

    UpdateExerciseTable(result.workout);
}

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

//every workout type shares one table and one shape:
//{workout_name, notes, exercises: [{ex_block, ex_name, sets_reps, ex_notes}, ...]}
function UpdateExerciseTable(data) {
    const tbody = document.getElementById('workout_body');
    const metaSpan = document.getElementById('workout-meta');

    //the edit modal acts on whatever is on screen, so the card's id moves with the table
    workoutCard.dataset.recordId = data.id || "";
    syncEditButton(editWorkoutBtn, workoutCard);

    if (metaSpan) {
        metaSpan.textContent = data.workout_name || "";
    }

    //session-level notes ride along with every workout payload; hide the panel when there are none
    const notesPanel = document.getElementById('workout-notes');
    const notesText = document.getElementById('workout-notes-text');
    if (notesPanel && notesText) {
        notesText.innerHTML = data.notes || ""; //pre-formatted with <br> by the backend
        notesPanel.classList.toggle('hidden', !data.notes);
    }

    tbody.innerHTML = "";
    data.exercises.forEach(ex => {
        const row = tbody.insertRow();
        //data-label drives the stacked card layout on mobile, so rebuilt cells need it too
        addCell(row, "Block").textContent = ex.ex_block;
        addCell(row, "Exercise").textContent = ex.ex_name;
        addCell(row, "Sets/Reps").textContent = ex.sets_reps;
        addCell(row, "Notes").innerHTML = ex.ex_notes; //pre-formatted with <br> by the backend
    });
}

//warmup shape is one row of exercise-category columns, not a list of exercises
function UpdateWarmupTable(data) {
    const tbody = document.getElementById('warmups_body');
    tbody.innerHTML = "";

    warmupCard.dataset.recordId = data.id || "";
    syncEditButton(editWarmupBtn, warmupCard);

    const row = tbody.insertRow();
    addCell(row, "Name").textContent = data.name;
    addCell(row, "Rollout Exercises").innerHTML = data.rollout_ex;
    addCell(row, "Spine Exercises").innerHTML = data.spine_ex;
    addCell(row, "Hip Exercises").innerHTML = data.hip_ex;
    addCell(row, "Shoulder Exercises").innerHTML = data.shoulder_ex;
    addCell(row, "Arm Exercises").innerHTML = data.arm_ex;
    addCell(row, "Dynamic Exercises").innerHTML = data.dynamic_ex;
    addCell(row, "Notes").innerHTML = data.notes;
}