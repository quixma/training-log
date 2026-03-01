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
      	<option value = "Pitching">Pitching</option>
      	<option value = "Medball">Medball</option>
      	<option value = "CVB">CVB</option>
      	<option value = "AB">AB</option>
			<option value = "Club">Club</option>
      </select>
      <select name="drill_ball_weight[]">
        <option value="">Ball Weight</option>
        <option value = "3">3</option>
        <option value = "3.5">3.5</option>
        <option value = "4">4</option>
        <option value = "5">5</option>
        <option value = "6">6</option>
        <option value = "7">7</option>
        <option value = "9">9</option>
        <option value = "11">11</option>
        <option value = "16">16</option>
        <option value = "21">21</option>
        <option value = "32">32</option>
        <option value = "48">48</option>
        <option value = "64">64</option>
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