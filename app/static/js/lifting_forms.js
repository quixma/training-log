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