const sidebarToggle = document.querySelector('.sidebar-toggle');
sidebarToggle.addEventListener('click', () => {
  const expanded = sidebarToggle.getAttribute('aria-expanded') === 'true';
  sidebarToggle.setAttribute('aria-expanded', String(!expanded));
  sidebarToggle.textContent = expanded ? '☰ Menu' : '× Close menu';
});
