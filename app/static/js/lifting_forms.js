//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

function addExRow(containerId, rowClass = 'ex-row') {
    const container = document.getElementById(containerId);
    const newRow = document.createElement('div');
    newRow.classList.add(rowClass);
    newRow.innerHTML = `
      <input type="text" autocomplete="off" name="ex_block[]" placeholder="Block">
      <input type="text" autocomplete="off" name="ex_name[]" placeholder="Exercise Name">
      <input type="text" autocomplete="off" name="sets_reps[]" placeholder="Sets/Reps">
      <input type="text" autocomplete="off" name="ex_notes[]" placeholder="Exercise Notes">
    `;
    container.appendChild(newRow);
    clearRow(newRow);
}

function deleteExRow(containerId, rowClass = 'ex-row') {
    const container = document.getElementById(containerId);
    const divElements = container.querySelectorAll(`.${rowClass}`);
    const rowAmount = divElements.length;
    if (rowAmount === 0) return;
    const indextoDelete = rowAmount - 1;

    divElements[indextoDelete].remove();
}

//ball weights offered by the throwing day form's drill rows; mirrors THROWING_BALL_WEIGHTS in models.py
const BALL_WEIGHTS = ['3', '3.5', '4', '5', '6', '7', '9', '11', '16', '21', '32', '48', '64', 'jav', 'football', 'club', 'volleyball', 'tennis'];

//drill rows for the throwing day form. Parameterized by container and field prefix so the plyo and
//throwing blocks can post as two separate sets of arrays from the same page.
function addDrillRow(containerId, rowClass, prefix) {
    const container = document.getElementById(containerId);
    const newRow = document.createElement('div');
    newRow.classList.add(rowClass);

    const weightOptions = BALL_WEIGHTS.map(w => `<option value="${w}">${w}</option>`).join('');
    newRow.innerHTML = `
      <input type="text" name="${prefix}_drill_name[]" placeholder="Drill Name">
      <select autocomplete="off" name="${prefix}_ball_weight[]">
        <option value="">Ball Weight</option>
        ${weightOptions}
      </select>
      <input type="text" name="${prefix}_throw_count[]" placeholder="Throw Count (e.g. 5-10)">
      <input type="text" name="${prefix}_drill_notes[]" placeholder="Drill Notes">
    `;
    container.appendChild(newRow);
    clearRow(newRow);
}

function deleteDrillRow(containerId, rowClass) {
    const container = document.getElementById(containerId);
    const divElements = container.querySelectorAll(`.${rowClass}`);
    const rowAmount = divElements.length;
    if (rowAmount === 0) return;

    divElements[rowAmount - 1].remove();
}

// ── Warmup / Workout Panels ───────────────────────────────────────────────────
//
// The View Warmups and View Workouts tabs, moved here from training_calendar.js along
// with the panels themselves. The dropdowns fetch a record, the tables rerender from
// it, and the edit modals act on whatever record is currently on screen.

//initialize drop down menu selectors
const warmupSelect = document.getElementById('retrieve-warmup')
const workoutTypeSelect = document.getElementById('retrieve-workout-type')
const workoutSelect = document.getElementById('retrieve-workout')

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

// a modal always opens at the top. the panel keeps whatever scroll offset it was
// hidden at, and the save button sits at the very bottom - so closing by saving
// re-showed the panel mid-scroll, and the first touch gesture went nowhere
function openModal(id) {
    const modal = document.getElementById(id);
    const inner = modal.querySelector('.modal-inner');
    if (inner) inner.scrollTop = 0;
    modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    const inner = modal.querySelector('.modal-inner');
    if (inner) inner.scrollTop = 0;
    modal.classList.remove('active');
}

//----------------GET/DISPLAY WORKOUTS FROM DROPDOWNS----------------
//switching workout type swaps in that type's name list. it takes both a type and a name to
//identify a workout, so the panel stays empty until the second half of that is picked
async function GetWorkoutsByType() {
    //the type select opens on a blank placeholder, and picking it again means "nothing
    //selected". the API only accepts real workout types, so clear the panel rather than
    //fetch an empty type and surface a 400
    if (!workoutTypeSelect.value) {
        workoutSelect.innerHTML = '<option value="">Select Workout to View</option>';
        UpdateExerciseTable({ exercises: [] });
        return;
    }

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

    //a type on its own does not name a workout, so the panel is cleared rather than filled
    //with that type's latest - which read as though it were the one the name select showed
    UpdateExerciseTable({ exercises: [] });
}

//tabName is 'warmup' or a workout_type value ('Lift', 'Back/Core', ...)
async function GetSelectedWorkout(tabName) {
    //with no type picked there is nothing to look a name up in, and an empty type is a 400
    //at the API. the name list is empty in that state anyway, so this is a backstop
    if (!tabName) return;

    const select = tabName === 'warmup' ? warmupSelect : workoutSelect;
    const data = { type: tabName, value: select.value };

    if (!data.value) {
        //re-picking the blank placeholder means nothing is selected. leaving the last
        //record on screen reads as though it belonged to what the dropdowns now say
        if (tabName === 'warmup') UpdateWarmupTable({});
        else UpdateExerciseTable({ exercises: [] });
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

    //no warmup picked: the panel stays empty rather than showing a row of blanks
    if (!data.id) return;

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

//---------EDIT WORKOUTS FUNCTIONS---------------
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
    //fills in exercise details, sets, reps etc
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

    submitRecordChange('/api/updateWorkout', updatedWorkout, 'Update failed.', 'workouts');
}

deleteWorkoutBtn.onclick = function () {
    if (!confirm("Delete this workout and its exercises? This cannot be undone.")) {
        return;
    }

    submitRecordChange('/api/deleteRecord',
        { record_type: 'workout', id: Number(workoutCard.dataset.recordId) }, 'Delete failed.', 'workouts');
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

    submitRecordChange('/api/updateWarmup', updatedWarmup, 'Update failed.', 'warmup_workouts');
}

deleteWarmupBtn.onclick = function () {
    if (!confirm("Delete this warmup? This cannot be undone.")) {
        return;
    }

    submitRecordChange('/api/deleteRecord',
        { record_type: 'warmup', id: Number(warmupCard.dataset.recordId) }, 'Delete failed.', 'warmup_workouts');
}


// ── Throwing Days Panel ───────────────────────────────────────────────────────
//
// The View Throwing Days tab, moved here from inszn_home.js. Same shape as the two
// panels above: the dropdown fetches a day, the table rerenders from it, and the edit
// modal acts on whatever day is on screen.

//edit modal for the logged throwing day currently on screen. the card carries the day's
//id in data-record-id, refreshed whenever the table swaps in a different day
const throwingDayCard = document.getElementById('throwing-day-card')
const editThrowingDayBtn = document.getElementById('editThrowingDay')
const saveThrowingDayBtn = document.getElementById('saveThrowingDay')
const deleteThrowingDayBtn = document.getElementById('deleteThrowingDay')

//pairs each drill row field with its key in the throwing day payload
const DRILL_FIELDS = {
    '.row-drill-name': 'drill_name',
    '.row-ball-weight': 'ball_weight',
    '.row-throw-count': 'throw_count',
    '.row-drill-notes': 'drill_notes',
}
const throwingDayViewSelect = document.getElementById('retrieve-throwing-day')

//logged throwing days: pick a day by name, swap its drills and notes into the tab
async function GetThrowingDay() {
    const name = throwingDayViewSelect.value;

    if (!name) {
        //re-picking the blank placeholder means nothing is selected. leaving the last
        //day on screen reads as though it belonged to what the dropdown now says
        UpdateThrowingDayTable({ drills: [] });
        return;
    }
    else {
        const response = await fetch('/api/getThrowingDay',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ value: name })
            });

        // Check if response is ok before parsing, display to html
        if (!response.ok) {
            console.log('Update failed:', await response.text());
            alert('Update failed. See console.');
            return;
        }

        const data = await response.json();
        UpdateThrowingDayTable(data);
    }
}

//throwing day shape: {day_name, date, session_type, notes, drills: [{set, drill_name, ball_weight, throw_count, drill_notes}, ...]}
function UpdateThrowingDayTable(data) {
    const tbody = document.getElementById('throwing_day_body');
    const metaSpan = document.getElementById('throwing-day-meta');

    //the edit modal acts on whatever is on screen, so the card's id moves with the table
    throwingDayCard.dataset.recordId = data.id || "";
    syncEditButton(editThrowingDayBtn, throwingDayCard);
    const notesPanel = document.getElementById('throwing-day-notes');
    const notesText = document.getElementById('throwing-day-notes-text');

    if (metaSpan) {
        metaSpan.textContent = data.date ? `${data.date} \u00b7 ${data.session_type}` : "";
    }

    if (notesPanel && notesText) {
        notesText.innerHTML = data.notes || ""; //pre-formatted with <br> by the backend
        notesPanel.classList.toggle('hidden', !data.notes);
    }

    tbody.innerHTML = "";
    data.drills.forEach(drill => {
        const row = tbody.insertRow();
        //data-label drives the stacked card layout on mobile, so rebuilt cells need it too
        addCell(row, "Set").textContent = drill.set;
        addCell(row, "Drill").textContent = drill.drill_name;
        addCell(row, "Ball").textContent = drill.ball_weight;
        addCell(row, "Throws").textContent = drill.throw_count;
        addCell(row, "Notes").innerHTML = drill.drill_notes; //pre-formatted with <br> by the backend
    });
}

//── edit the throwing day on screen ──────────────────────────────────────
editThrowingDayBtn.onclick = async function () {
    const record = await fetchRecordForEdit('throwing_day', throwingDayCard.dataset.recordId);
    if (!record) {
        return;
    }

    document.getElementById("edit-day-date").value = record.date;
    document.getElementById("edit-day-name").value = record.day_name;
    document.getElementById("edit-day-session-type").value = record.session_type;
    document.getElementById("edit-day-notes").value = record.notes;
    fillModalRows('edit-plyo-rows', 'drill-row-template', record.plyo_drills, DRILL_FIELDS);
    fillModalRows('edit-throwing-rows', 'drill-row-template', record.throwing_drills, DRILL_FIELDS);

    openModal('editThrowingDay-modal');
}

document.getElementById('addPlyoRow').onclick = () => addModalRow('edit-plyo-rows', 'drill-row-template');
document.getElementById('removePlyoRow').onclick = () => removeModalRow('edit-plyo-rows');
document.getElementById('addThrowingRow').onclick = () => addModalRow('edit-throwing-rows', 'drill-row-template');
document.getElementById('removeThrowingRow').onclick = () => removeModalRow('edit-throwing-rows');

saveThrowingDayBtn.onclick = function () {
    const updatedDay = {
        id: Number(throwingDayCard.dataset.recordId),
        date: document.getElementById("edit-day-date").value,
        day_name: document.getElementById("edit-day-name").value,
        session_type: document.getElementById("edit-day-session-type").value,
        notes: document.getElementById("edit-day-notes").value,
        plyo_drills: readModalRows('edit-plyo-rows', DRILL_FIELDS),
        throwing_drills: readModalRows('edit-throwing-rows', DRILL_FIELDS)
    }

    submitRecordChange('/api/updateThrowingDay', updatedDay, 'Update failed.', 'ThrowingDays');
}

deleteThrowingDayBtn.onclick = function () {
    if (!confirm("Delete this throwing day and its drills? This cannot be undone.")) {
        return;
    }

    submitRecordChange('/api/deleteRecord',
        { record_type: 'throwing_day', id: Number(throwingDayCard.dataset.recordId) }, 'Delete failed.', 'ThrowingDays');
}

//the dropdowns, the modal plumbing, and the initial edit-button state
function wirePanels() {
    warmupSelect.addEventListener("change", () => GetSelectedWorkout('warmup'));
    workoutTypeSelect.addEventListener("change", GetWorkoutsByType);
    workoutSelect.addEventListener("change", () => GetSelectedWorkout(workoutTypeSelect.value));
    throwingDayViewSelect.addEventListener("change", GetThrowingDay);

    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });
    // Click outside to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    syncEditButton(editWorkoutBtn, workoutCard);
    syncEditButton(editWarmupBtn, warmupCard);
    syncEditButton(editThrowingDayBtn, throwingDayCard);
}

//a save or delete reloads the page with the tab it came from in the URL hash, so the
//reload lands back on that tab rather than on the first form
function restoreTab() {
    const tabName = window.location.hash.slice(1);
    if (!tabName) return;
    const button = Array.from(document.querySelectorAll('.tablinks'))
        .find(btn => btn.dataset.tab === tabName);
    if (button) button.click();
}

wirePanels();
restoreTab();
