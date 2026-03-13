function addDrillRow() {
    const container = document.getElementById('drills-container');
    const newRow = document.createElement('div');
    newRow.classList.add('drill-row');
    newRow.innerHTML = `
      <input type="text" name="drill_name[]" placeholder="Drill Name">
      <input type="number" step="0.01" name="drill_velocity[]" placeholder="Max Velocity">
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