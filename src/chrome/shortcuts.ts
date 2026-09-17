import { formatShortcut, getKeymapReference, shortcutGroups } from '@mindmap/widget';

/** The complete reference comes from the widget, including label-editing keys. */
export function shortcutsDialog(root: HTMLElement, mac: boolean, onClose: () => void): () => void {
  const dialog = document.createElement('dialog'); dialog.className = 'willow-shortcuts';
  const header = document.createElement('header'); header.className = 'willow-dialog-header';
  const title = document.createElement('h2'); title.id = `willow-shortcuts-${crypto.randomUUID()}`; title.textContent = 'Keyboard shortcuts';
  dialog.setAttribute('aria-labelledby', title.id);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.className = 'willow-dialog-close';
  close.setAttribute('aria-label', 'Close keyboard shortcuts');
  header.append(title, close);
  const body = document.createElement('div'); body.className = 'willow-shortcut-sections';
  const reference = getKeymapReference();
  for (const group of shortcutGroups) {
    const section = document.createElement('section'), heading = document.createElement('h3'), list = document.createElement('dl');
    heading.textContent = group; section.append(heading, list);
    for (const action of reference.filter(action => action.group === group)) {
      const row = document.createElement('div'), label = document.createElement('dt'), value = document.createElement('dd'), keys = document.createElement('kbd');
      row.dataset.action = action.id; label.textContent = action.label;
      keys.textContent = action.bindings.map(binding => formatShortcut(binding, mac)).join(' / ');
      value.append(keys); row.append(label, value); list.append(row);
    }
    body.append(section);
  }
  const footer = document.createElement('footer'); footer.className = 'willow-dialog-footer';
  const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done'; footer.append(done);
  dialog.append(header, body, footer); root.append(dialog);
  let closed = false;
  const finish = () => {
    if (closed) return; closed = true;
    dialog.close(); dialog.remove(); onClose();
  };
  close.onclick = done.onclick = finish;
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) finish();
  });
  dialog.showModal(); close.focus();
  return finish;
}
