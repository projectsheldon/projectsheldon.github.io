// tabs
const navTabs = document.querySelectorAll('.nav-tab');
navTabs.forEach(tab =>
{
    tab.addEventListener('click', () =>
    {
        navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});