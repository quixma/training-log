function addDrillRow() {
    const container = document.getElementById('drills-container');
    const newRow = document.createElement('div');
    newRow.classList.add('drill-row');
    newRow.innerHTML = `
      <input type="text" name="drill_name[]" placeholder="Drill Name">
      <select name="drill_type[]">
      	<option value =""> Drill Type </option>
      	<option value = "Plyo">Plyo</option>
      	<option value = "Mound_Plyo">Mound Plyo</option>
      	<option value = "Throwing">Throwing</option>
      </select>
     <label for="drill_throw_count[]">Throws:</label>
  	  <input type="text" id="drill_throw_count[]" name="drill_throw_count[]">
    `;
    container.appendChild(newRow);
}

function deleteDrillRow() {
    const container = document.getElementById('drills-container'); //parent element of all the drill rows
    const divElements = container.querySelectorAll(".drill-row"); //divs in which drill rows live
    const rowAmount = divElements.length;
    const indextoDelete = rowAmount - 1;

    divElements[indextoDelete].remove();


}

function addPreThrowDrillRow() {
    const container = document.getElementById('prethrow-container');
    const newRow = document.createElement('div');
    newRow.classList.add('prethrow-row');
    newRow.innerHTML = `
      <input type="text" name="prethrow_name[]" placeholder="Drill Name">
      <select name="prethrow_drill_type[]">
        <option value =""> Drill Type </option>
      	<option value = "Medball">Medball</option>
      	<option value = "CVB">CVB</option>
      	<option value = "AB">AB</option>
		<option value = "Club">Club</option>
      </select>
    `;
    container.appendChild(newRow);
}

function deletePreThrowDrillRow() {
    const container = document.getElementById('prethrow-container'); //parent element of all the drill rows
    const divElements = container.querySelectorAll(".prethrow-row"); //divs in which drill rows live
    const rowAmount = divElements.length;
    const indextoDelete = rowAmount - 1;

    divElements[indextoDelete].remove();


}