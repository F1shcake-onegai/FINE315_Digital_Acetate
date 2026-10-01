/**
 * Mobile copy (user): one sheet on screen at a time; ← → at the bottom right switch between them, as
 * do the arrow keys. `show` is called with the new page's index; page 0 shows first.
 */
export function createPager(count: number, show: (index: number) => void): void {
  let current = 0;
  const pager = document.createElement('div');
  pager.className = 'page-buttons';

  const button = (label: string, title: string, step: number) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.title = title;
    element.setAttribute('aria-label', title);
    element.addEventListener('click', () => go(current + step));
    return element;
  };
  const previous = button('←', 'Previous sheet', -1);
  const next = button('→', 'Next sheet', 1);

  function refresh(): void {
    previous.disabled = current === 0;
    next.disabled = current === count - 1;
  }
  function go(index: number): void {
    if (index < 0 || index >= count || index === current) return;
    current = index;
    refresh();
    show(index);
  }

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowLeft') go(current - 1);
    else if (event.key === 'ArrowRight') go(current + 1);
    else return;
    event.preventDefault();
  });

  refresh();
  pager.append(previous, next);
  document.body.append(pager);
}
