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

//every row shares one name (ex_name[] for all of them), and on iOS a freshly inserted
//field comes up holding the value of the field above it - same name, same form, so the
//browser treats the new one as that field and restores its value. the row is blank when
//it is built, so anything in it arrived on insertion: clear it once it is in the document,
//and again on the next frame in case the value lands after layout rather than during it
function clearRow(row) {
    const blank = () => row.querySelectorAll('input').forEach(input => {
        if (input.value !== '') input.value = '';
    });
    blank();
    requestAnimationFrame(blank);
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
}

function deleteDrillRow(containerId, rowClass) {
    const container = document.getElementById(containerId);
    const divElements = container.querySelectorAll(`.${rowClass}`);
    const rowAmount = divElements.length;
    if (rowAmount === 0) return;

    divElements[rowAmount - 1].remove();
}
