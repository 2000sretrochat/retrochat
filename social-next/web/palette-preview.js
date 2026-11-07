const palette = new URLSearchParams(location.search).get('palette');
const paletteOptions = [
  ['classic', 'Classic Blue'],
  ['ink', 'Ink Navy'],
  ['soda', 'Orange Soda'],
  ['arcade', 'After Hours'],
  ['poolside', 'Poolside'],
  ['berry', 'Berry Pop'],
];
if (paletteOptions.some(([id]) => id === palette)) {
  document.documentElement.dataset.palette = palette;
  if (palette === 'berry') {
    document.querySelector('.brand .bubble-logo').src = 'conversation-circle-berry.svg';
  }
  const comparison = document.createElement('nav');
  comparison.className = 'palette-preview';
  comparison.setAttribute('aria-label', 'Compare color palettes');
  comparison.innerHTML = '<span>Compare colors</span>';
  for (const [id, label] of paletteOptions) {
    const link = document.createElement('a');
    link.href = '?palette=' + id;
    link.textContent = label;
    if (id === palette) link.setAttribute('aria-current', 'page');
    comparison.append(link);
  }
  document.querySelector('header').after(comparison);
}
