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
      <input type="text" name="ex_block[]" placeholder="Exercise Block">
      <input type="text" name="ex_name[]" placeholder="Exercise Name">
      <input type="text" name="sets_reps[]" placeholder="Sets/Reps">
      <input type="text" name="ex_notes[]" placeholder="Exercise Notes">
    `;
    container.appendChild(newRow);
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
      <select name="${prefix}_ball_weight[]">
        <option value="">Ball Weight</option>
        ${weightOptions}
      </select>
      <input type="text" name="${prefix}_throw_count[]" placeholder="Throw Count (e.g. 5-10)">
      <input type="text" name="${prefix}_drill_notes[]" placeholder="Drill Notes">
    `;
    container.appendChild(newRow);
}

function deleteDrillRow(containerId, rowClass) {
    const container = document.getElementById(containerId);
    const divElements = container.querySelectorAll(`.${rowClass}`);
    const rowAmount = divElements.length;
    if (rowAmount === 0) return;

    divElements[rowAmount - 1].remove();
}
