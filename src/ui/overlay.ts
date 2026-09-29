import { config } from '../config';
import type { ViewControls } from '../interaction/viewControls';

const MS_PER_S = 1000;

/** §6.4: bottom-left usage hint that fades after a few seconds; − + Reset buttons top-right. */
export function createOverlay(view: ViewControls): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = config.ui.hint;

  const buttons = document.createElement('div');
  buttons.className = 'view-buttons';
  const actions: [label: string, title: string, run: () => void][] = [
    ['−', 'Zoom out', view.zoomOut],
    ['+', 'Zoom in', view.zoomIn],
    ['Reset', 'Reset view', view.reset],
  ];
  for (const [label, title, run] of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', run);
    buttons.append(button);
  }

  overlay.append(hint, buttons);
  document.body.append(overlay);
  window.setTimeout(() => hint.classList.add('faded'), config.ui.hintFadeS * MS_PER_S);
}
