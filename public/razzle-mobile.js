(() => {
  const viewport = window.visualViewport;
  const narrow = matchMedia('(max-width: 1024px)');
  function fitVisibleArea() {
    const style = document.documentElement.style;
    if (viewport && narrow.matches && Math.abs(viewport.scale - 1) < 0.01) {
      style.setProperty('--rz-visible-height', Math.round(viewport.height) + 'px');
    } else {
      style.removeProperty('--rz-visible-height');
    }
  }
  viewport?.addEventListener('resize', fitVisibleArea);
  window.addEventListener('resize', fitVisibleArea);
  fitVisibleArea();

  const room = document.getElementById('chat');
  const people = document.getElementById('mobile-people');
  if (!room || !people) return;
  function showPeople(open) {
    room.classList.toggle('mobile-people-open', open);
    people.setAttribute('aria-expanded', String(open));
  }
  people.addEventListener('click', () => showPeople(people.getAttribute('aria-expanded') !== 'true'));
  room.addEventListener('click', event => {
    if (!event.target.closest('#mpane, #mobile-people') && people.getAttribute('aria-expanded') === 'true') showPeople(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && people.getAttribute('aria-expanded') === 'true') {
      showPeople(false);
      people.focus();
    }
  });
})();
