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