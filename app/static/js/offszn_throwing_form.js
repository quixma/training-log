function addDrillRow() {
    const container = document.getElementById('drills-container');
    const newRow = document.createElement('div');
    newRow.classList.add('drill-row');
    newRow.innerHTML = `
      <input type="text" name="drill_name[]" placeholder="Drill Name">
      <select name="drill_ball_weight[]">
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
      </select>
      <input type="number" step="0.01" name="drill_velocity[]" placeholder="Max Velocity">
      <input type="number" step="0.01" name="throw_count[]" placeholder="Throw Count">
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