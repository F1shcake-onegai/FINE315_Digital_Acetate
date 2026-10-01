/** The loading note in index.html: it shows from the first paint until the sheets are on screen. */
const note = () => document.querySelector<HTMLElement>('#loading');

/** Fade the note out once the sheets have been drawn. */
export function loadingDone(): void {
  const element = note();
  if (!element) return;
  element.classList.add('done');
  element.addEventListener('transitionend', () => element.remove(), { once: true });
}

/** The sheets couldn't be built: say so instead. */
export function loadingFailed(): void {
  const element = note();
  if (element) element.textContent = 'The contact sheets could not be loaded. Reload the page to try again.';
}
