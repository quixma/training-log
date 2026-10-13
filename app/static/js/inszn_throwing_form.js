//removes the row the user picked; with nothing picked it falls back to the last row
function deleteSelectedRow(containerId, rowClass) {
    const container = document.getElementById(containerId); //parent element of all the rows
    const divElements = container.querySelectorAll(`.${rowClass}`); //divs in which the rows live
    const rowAmount = divElements.length;
    if (rowAmount === 0) return;

    const picked = container.querySelector(`.${rowClass}.selected`);
    (picked || divElements[rowAmount - 1]).remove();
}

//clicking or tabbing into a row picks it as the one the remove button acts on. one pick
//per container. delegated from the document because rows are added after load
function selectFormRow(event) {
    const row = event.target.closest('.drill-row');
    if (!row) {
        return;
    }
    row.parentElement.querySelectorAll(':scope > .selected').forEach(other => {
        if (other !== row) {
            other.classList.remove('selected');
        }
    });
    row.classList.add('selected');
}
document.addEventListener('click', selectFormRow);
document.addEventListener('focusin', selectFormRow);

function addDrillRow() {
    const container = document.getElementById('drills-container');
    const newRow = document.createElement('div');
    newRow.classList.add('drill-row');
    newRow.innerHTML = `
      <input type="text" name="drill_name[]" placeholder="Drill Name">
      <select autocomplete="off" name="drill_ball_weight[]">
        <option value="">Ball Weight</option>
        <option>3</option>
        <option>3.5</option>
        <option>4</option>
        <option>5</option>
        <option>6</option>
        <option>7</option>
        <option>9</option>
        <option>11</option>
        <option>16</option>
        <option>21</option>
        <option>32</option>
        <option>48</option>
        <option>64</option>
        <option>jav</option>
        <option>football</option>
        <option>club</option>
        <option>volleyball</option>
        <option>tennis</option>
      </select>
      <input type="number" step="0.01" name="drill_velocity[]" placeholder="Max Velo">
      <input type="number" name="throw_count[]" placeholder="Throw Count">
    `;
    container.appendChild(newRow);
    clearRow(newRow);
}

function deleteDrillRow() {
    deleteSelectedRow('drills-container', 'drill-row');
}