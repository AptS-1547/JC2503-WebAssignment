const navToggle = document.querySelector('.nav-toggle');
const navActions = document.querySelector('.nav-actions');
const themeToggle = document.querySelector('.theme-toggle');
const fallbackImages = document.querySelectorAll('img[data-fallback-src]');

if (navToggle && navActions) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    navActions.classList.toggle('open', !isOpen);
  });

  navActions.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navToggle.setAttribute('aria-expanded', 'false');
      navActions.classList.remove('open');
    }
  });
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(nextTheme);
    localStorage.setItem('theme', nextTheme);
  });
}

fallbackImages.forEach((image) => {
  image.addEventListener('error', () => {
    const fallbackSrc = image.dataset.fallbackSrc;

    if (fallbackSrc && image.getAttribute('src') !== fallbackSrc) {
      image.setAttribute('src', fallbackSrc);
    }
  });
});
