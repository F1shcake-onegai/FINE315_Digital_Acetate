const note = () => document.querySelector<HTMLElement>('#loading');

export function loadingDone(): void {
  const element = note();
  if (!element) return;
  element.classList.add('done');
  element.addEventListener('transitionend', () => element.remove(), { once: true });
}

export function loadingFailed(): void {
  const element = note();
  if (element) element.textContent = 'Failed to load. Reload to retry.';
}
