document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sb-btn');
    const content = document.getElementById('content');

    // 1. Check localStorage for saved state on page load. Phone widths start collapsed
    //    whatever was saved on desktop - 250px of a 390px screen leaves no room for the page.
    //    The toggle still works, so the nav is one tap away.
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true'
        || window.matchMedia('(max-width: 900px)').matches;

    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        content.classList.add('expanded');
    }

    // 2. Add the click event listener
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            // Toggle classes
            sidebar.classList.toggle('collapsed');
            content.classList.toggle('expanded');

            // 3. Save the new state
            const nowCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebar-collapsed', nowCollapsed);
        });
    }
});

//a row added to a form is blank when it is built, so anything in it was put there by the
//browser once it entered the document: on iOS a freshly inserted field comes up holding
//the value of the field above it, which shares its name. clear the row on insertion, and
//again on the next frame in case the value lands after layout rather than during it.
//every select these rows carry opens with an empty-valued placeholder option, so clearing
//one returns it to that placeholder
function clearRow(row) {
    const blank = () => row.querySelectorAll('input, select, textarea').forEach(field => {
        if (field.value !== '') field.value = '';
    });
    blank();
    requestAnimationFrame(blank);
}
