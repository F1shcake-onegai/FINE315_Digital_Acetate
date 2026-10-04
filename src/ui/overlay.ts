import type { ViewControls } from '../interaction/viewControls';

export function createOverlay(view: ViewControls): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

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

  overlay.append(buttons);
  document.body.append(overlay);
}
