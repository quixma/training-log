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
    const row = event.target.closest('.drill-row, .prethrow-row');
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
      <select autocomplete="off" name="drill_type[]">
      	<option value =""> Drill Type </option>
      	<option value = "Plyo">Plyo</option>
      	<option value = "Mound_Plyo">Mound Plyo</option>
      	<option value = "Throwing">Throwing</option>
      </select>
     <label for="drill_throw_count[]">Throws:</label>
  	  <input type="text" id="drill_throw_count[]" name="drill_throw_count[]">
    `;
    container.appendChild(newRow);
    clearRow(newRow);
}

function deleteDrillRow() {
    deleteSelectedRow('drills-container', 'drill-row');
}

function addPreThrowDrillRow() {
    const container = document.getElementById('prethrow-container');
    const newRow = document.createElement('div');
    newRow.classList.add('prethrow-row');
    newRow.innerHTML = `
      <input type="text" name="prethrow_name[]" placeholder="Drill Name">
      <select autocomplete="off" name="prethrow_drill_type[]">
        <option value =""> Drill Type </option>
      	<option value = "Medball">Medball</option>
      	<option value = "CVB">CVB</option>
      	<option value = "AB">AB</option>
		<option value = "Club">Club</option>
        <option value = "Plyo">Plyo</option>
      </select>
    `;
    container.appendChild(newRow);
    clearRow(newRow);
}

function deletePreThrowDrillRow() {
    deleteSelectedRow('prethrow-container', 'prethrow-row');
}