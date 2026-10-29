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
      <select autocomplete="off" name="throw_type[]">
        <option value="">Throw Type</option>
        <option value="implement">Implement</option>
        <option value="plyo">Plyo</option>
        <option value="regular">Regular</option>
        <option value="working_set">Working Set</option>
        <option value="bullpen_high_intent">Bullpen / High Intent</option>
      </select>
      <select autocomplete="off" name="drill_ball_weight[]">
        <option value="">Ball Weight</option>
        <option value="3">3</option>
        <option value="3.5">3.5</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
        <option value="7">7</option>
        <option value="9">9</option>
        <option value="11">11</option>
        <option value="16">16</option>
        <option value="21">21</option>
        <option value="32">32</option>
        <option value="48">48</option>
        <option value="64">64</option>
        <option value="jav">jav</option>
        <option value="football">football</option>
        <option value="club">club</option>
        <option value="volleyball">volleyball</option>
        <option value="tennis">tennis</option>
      </select>
      <input type="number" name="throw_count[]" placeholder="Throw Count" min="1">
    `;
    container.appendChild(newRow);
}

function deleteDrillRow() {
    deleteSelectedRow('drills-container', 'drill-row');
}