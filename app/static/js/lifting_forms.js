
//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

function addExRow() {
    const container = document.getElementById('ex-container');
    const newRow = document.createElement('div');
    newRow.classList.add('ex-row');
    newRow.innerHTML = `
      <input type="text" name="ex_name[]" placeholder="Exercise Name">
      <input type="text" name="sets_reps[]" placeholder="Sets/Reps">
    `;
    container.appendChild(newRow);
}

function deleteExRow() {
    const container = document.getElementById('ex-container');
    const divElements = container.querySelectorAll(".ex-row");
    const rowAmount = divElements.length;
    const indextoDelete = rowAmount - 1;

    divElements[indextoDelete].remove();
}

function addBackExRow() {
    const container = document.getElementById('ex-container-back');
    const newRow = document.createElement('div');
    newRow.classList.add('ex-row-back');
    newRow.innerHTML = `
      <input type="text" name="ex_name[]" placeholder="Exercise Name">
      <input type="text" name="sets_reps[]" placeholder="Sets/Reps">
    `;
    container.appendChild(newRow);
}

function deleteBackExRow() {
    const container = document.getElementById('ex-container-back');
    const divElements = container.querySelectorAll(".ex-row-back");
    const rowAmount = divElements.length;
    const indextoDelete = rowAmount - 1;

    divElements[indextoDelete].remove();


}