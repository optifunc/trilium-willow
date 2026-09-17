import { ContextMenu, formatShortcut, getCommandDescriptors, getKeymapReference, getNodeMenuDescriptors, isMacPlatform, resolveShortcut } from '@mindmap/widget';
import type { ActionId, CommandDescriptor, ContextMenuRequest, MenuEntry, MindMapCommand, MindMapEditor } from '@mindmap/widget';
import { icon } from './icons';
import { overflowActions, paneSummary, steppedZoom, toolbarGroups } from './model';
import type { PaneState } from './model';
import { shortcutsDialog } from './shortcuts';
import { Tooltip } from './tooltip';

interface Options {
  state(): PaneState;
  composing(): boolean;
  commitEdit(): void;
  interaction(): void;
  documentation(): Promise<void>;
  report(message: string): void;
}
const glyphs: Partial<Record<ActionId, string>> = {
  undo: 'undo', redo: 'redo', insertChild: 'child', insertAfter: 'sibling', delete: 'delete',
  edit: 'edit', toggleCheckbox: 'checkbox', toggleCollapse: 'collapse', fit: 'fit',
};

/** Pane-owned DOM: button identity survives synchronous label commits and host redraws. */
export class PaneChrome {
  private editor?: MindMapEditor;
  private subscriptions: (() => void)[] = [];
  private abort = new AbortController();
  private resize: ResizeObserver;
  private menu: ContextMenu;
  private menuOpen = false;
  private closeMoreOnClick = false;
  private tooltip: Tooltip;
  private closeDialog?: () => void;
  private buttons = new Map<string, HTMLButtonElement>();
  private summary = document.createElement('span');
  private live = document.createElement('span');
  private frame = 0;
  private documentationTimer?: ReturnType<typeof setTimeout>;
  private width = 0;
  private height = 0;
  private hidden = false;
  private destroyed = false;
  private mac = isMacPlatform(navigator.platform);

  constructor(private root: HTMLElement, private canvas: HTMLElement,
    private toolbar: HTMLElement, private status: HTMLElement, private options: Options) {
    this.tooltip = new Tooltip(root);
    this.menu = new ContextMenu(root, command => this.can(command), command => this.execute(command));
    toolbar.className = 'willow-toolbar'; toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Mind map commands');
    status.className = 'willow-statusbar'; status.setAttribute('role', 'group'); status.setAttribute('aria-label', 'Mind map status and viewport');
    toolbarGroups.forEach((actions, index) => {
      if (index) { const rule = this.divider(); rule.dataset.group = String(index); toolbar.append(rule); }
      const group = document.createElement('div'); group.className = 'willow-command-group'; group.dataset.group = String(index);
      for (const id of actions) group.append(this.button(id, glyphs[id]!, id === 'insertChild' || id === 'insertAfter'));
      toolbar.append(group);
    });
    const more = this.button('more', 'down', true); more.classList.add('willow-more');
    more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false');
    this.label(more, 'More commands', 'More'); toolbar.append(more, this.spacer());
    const help = document.createElement('div'); help.className = 'willow-help-group';
    const shortcuts = this.button('help', 'help'), documentation = this.button('documentation', 'documentation');
    this.label(shortcuts, 'Keyboard shortcuts'); this.label(documentation, 'Documentation'); help.append(shortcuts, documentation); toolbar.append(help);
    this.summary.className = 'willow-context'; status.append(this.summary, this.spacer());
    const zoom = document.createElement('div'); zoom.className = 'willow-zoom-controls';
    const minus = this.button('minus', 'minus'), percent = this.button('percentage', '', true), plus = this.button('plus', 'plus');
    this.label(minus, 'Zoom out'); this.label(plus, 'Zoom in'); this.label(percent, 'Reset zoom to 100 percent', '100%');
    percent.classList.add('willow-percentage');
    const fit = this.button('fit', 'fit', true); this.label(fit, 'Fit map', 'Fit');
    zoom.append(minus, percent, plus, this.divider(), fit); status.append(zoom);
    this.live.className = 'willow-sr-only'; this.live.setAttribute('role', 'status'); this.live.setAttribute('aria-live', 'polite'); root.append(this.live);
    const signal = this.abort.signal;
    toolbar.addEventListener('keydown', event => this.rove(event), { signal });
    // Installed before the widget's label handlers. Do not let a chrome press
    // finish an IME buffer before composition has ended.
    document.addEventListener('pointerdown', event => {
      this.tooltip.hide();
      this.closeMoreOnClick = this.menuOpen && this.buttons.get('more')!.contains(event.target as Node);
      if (this.options.composing() && (toolbar.contains(event.target as Node) || status.contains(event.target as Node)
        || (root.contains(event.target as Node) && (event.target as Element).closest?.('.mindmap-menu')))) {
        event.preventDefault(); event.stopImmediatePropagation(); this.announce('Finish text composition before using map commands.');
      }
    }, { signal, capture: true });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') this.tooltip.hide(); }, { signal, capture: true });
    document.addEventListener('scroll', () => this.tooltip.hide(), { signal, capture: true });
    window.addEventListener('resize', () => this.tooltip.hide(), { signal });
    window.addEventListener('blur', () => this.tooltip.hide(), { signal });
    root.addEventListener('contextmenu', event => {
      if (!this.fallbackTarget(event.target)) return;
      event.preventDefault(); event.stopPropagation(); this.openContext(event.clientX, event.clientY);
    }, { signal });
    root.addEventListener('keydown', event => {
      if (!this.fallbackTarget(event.target) || resolveShortcut(event, 'canvas', this.mac)?.id !== 'contextMenu') return;
      event.preventDefault(); event.stopPropagation();
      const bounds = canvas.getBoundingClientRect(); this.openContext(bounds.left + 8, bounds.top + 8);
    }, { signal });
    this.resize = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = root;
      if (width !== this.width || height !== this.height) { this.closeMenu(); this.tooltip.hide(); }
      this.width = width; this.height = height; this.update();
    });
    this.resize.observe(root); this.width = root.clientWidth; this.height = root.clientHeight;
    this.update();
  }

  private fallbackTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && !target.closest('textarea, input, button, a, [role="menu"], dialog')
      && (target === this.root || target === this.canvas || this.canvas.contains(target));
  }
  private spacer() { const span = document.createElement('span'); span.className = 'willow-spacer'; return span; }
  private divider() { const span = document.createElement('span'); span.className = 'willow-divider'; span.setAttribute('aria-hidden', 'true'); return span; }
  private button(id: string, glyph: string, text = false) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.action = id;
    if (glyph) button.append(icon(glyph));
    if (text) { const label = document.createElement('span'); label.className = 'willow-button-label'; button.append(label); }
    else button.className = 'willow-icon-button';
    const signal = this.abort.signal;
    button.addEventListener('pointerenter', () => this.tooltip.show(button), { signal });
    button.addEventListener('pointerleave', () => this.tooltip.hide(), { signal });
    button.addEventListener('focus', () => { if (button.matches(':focus-visible') && !this.menuOpen && !this.closeDialog) this.tooltip.show(button, true); }, { signal });
    button.addEventListener('blur', () => this.tooltip.hide(), { signal });
    button.addEventListener('click', () => this.activate(id, button), { signal });
    this.buttons.set(id, button); return button;
  }
  private label(button: HTMLButtonElement, label: string, text?: string, descriptor?: CommandDescriptor) {
    button.setAttribute('aria-label', label);
    if (text !== undefined) button.querySelector('.willow-button-label')!.textContent = text;
    const binding = descriptor?.bindings[0];
    button.dataset.tooltip = `${label}${binding ? ` (${formatShortcut(binding, this.mac)})` : ''}`;
    if (binding) button.setAttribute('aria-keyshortcuts', formatShortcut(binding, this.mac, true)); else button.removeAttribute('aria-keyshortcuts');
  }
  private available() {
    const state = this.options.state();
    return !!this.editor && !state.invalid && !state.loading && !state.recovering;
  }
  private can(command: MindMapCommand) { return this.available() && !!this.editor?.canExecute(command); }
  private focusCanvas() {
    if (this.destroyed) return;
    const textarea = this.canvas.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea && !this.canvas.inert) textarea.focus({ preventScroll: true });
    else if (this.available()) this.editor!.focus();
    else this.root.focus({ preventScroll: true });
  }
  private finishEdit() {
    if (this.options.composing()) { this.announce('Finish text composition before using map commands.'); return false; }
    try { this.options.commitEdit(); return true; }
    catch (error) { this.options.report(String(error)); return false; }
  }
  private execute(command: MindMapCommand) {
    if (!this.finishEdit() || !this.can(command)) return;
    this.options.interaction(); this.editor!.execute(command); this.focusCanvas(); this.update();
  }
  private activate(id: string, button: HTMLButtonElement) {
    this.tooltip.hide();
    if (!this.finishEdit()) return;
    if (id === 'more') {
      const close = this.menuOpen || this.closeMoreOnClick; this.closeMoreOnClick = false;
      if (close) this.closeMenu(); else this.openMore(button); return;
    }
    if (id === 'help') { this.help(button); return; }
    if (id === 'documentation') { this.documentation(); return; }
    if (!this.available()) return;
    if (id === 'minus' || id === 'plus') {
      this.options.interaction(); this.editor!.setZoom(steppedZoom(this.editor!.getViewport().zoom, id === 'minus' ? -1 : 1));
      this.focusCanvas(); this.update(); return;
    }
    const descriptor = this.editor!.getCommands().find(item => item.id === (id === 'percentage' ? 'resetZoom' : id));
    if (descriptor) this.execute(descriptor.command);
  }
  bindEditor(editor?: MindMapEditor) {
    this.closeMenu(); this.tooltip.hide();
    for (const unsubscribe of this.subscriptions) unsubscribe(); this.subscriptions = [];
    this.editor = editor;
    if (editor) {
      for (const event of ['documentchange', 'selectionchange', 'editstart', 'editcommit', 'editcancel'] as const)
        this.subscriptions.push(editor.on(event, () => { this.closeMenu(); this.update(); }));
      this.subscriptions.push(editor.on('viewportchange', () => {
        this.closeMenu(); this.tooltip.hide();
        if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
      }));
      this.subscriptions.push(editor.on('commandcomplete', ({ command }) => this.announce(`${command === 'copy' ? 'Copied' : command === 'cut' ? 'Cut' : 'Pasted'} selection.`)));
    }
    this.update();
  }
  update() {
    if (this.destroyed) return;
    const state = this.options.state();
    const descriptors = this.editor?.getCommands() ?? getCommandDescriptors();
    for (const id of toolbarGroups.flat()) {
      const button = this.buttons.get(id)!, descriptor = descriptors.find(item => item.id === id)!;
      this.label(button, descriptor.toolbarLabel, id === 'insertChild' || id === 'insertAfter' ? descriptor.toolbarLabel : undefined, descriptor);
      button.disabled = !this.can(descriptor.command);
      if (this.available() && (id === 'undo' || id === 'redo')) button.disabled = !(id === 'undo' ? this.editor!.canUndo() : this.editor!.canRedo());
    }
    const zoom = this.editor?.getViewport().zoom ?? 1;
    this.buttons.get('minus')!.disabled = !this.available() || zoom <= .25;
    this.buttons.get('plus')!.disabled = !this.available() || zoom >= 4;
    const percent = this.buttons.get('percentage')!; percent.disabled = !this.available();
    this.label(percent, 'Reset zoom to 100 percent', `${Math.round(zoom * 100)}%`);
    const reset = descriptors.find(item => item.id === 'resetZoom')!;
    percent.dataset.tooltip = `${reset.label} (${formatShortcut(reset.bindings[0]!, this.mac)})`;
    percent.setAttribute('aria-keyshortcuts', formatShortcut(reset.bindings[0]!, this.mac, true));
    const fit = this.buttons.get('fit')!; fit.disabled = !this.can({ type: 'fit' });
    this.label(fit, 'Fit map', 'Fit', descriptors.find(item => item.id === 'fit'));
    const reference = getKeymapReference();
    const binding = (id: string) => formatShortcut(reference.find(action => action.id === id)!.bindings[0]!, this.mac);
    const summary = paneSummary(state, `${binding('finishEditing')} to finish · ${binding('cancelEditing')} to cancel`);
    if (this.summary.textContent !== summary) { this.summary.textContent = summary; if (summary) this.announce(summary); }
    this.syncTabStop();
  }
  private toolbarButtons() {
    return [...this.toolbar.querySelectorAll<HTMLButtonElement>('button')].filter(button => !button.disabled && button.checkVisibility());
  }
  private syncTabStop() {
    const enabled = this.toolbarButtons();
    const current = enabled.find(button => button === document.activeElement) ?? enabled.find(button => button.tabIndex === 0) ?? enabled[0];
    for (const button of this.toolbar.querySelectorAll('button')) button.tabIndex = button === current ? 0 : -1;
    if (this.toolbar.contains(document.activeElement) && document.activeElement !== current
      && (!(document.activeElement as HTMLElement).checkVisibility() || (document.activeElement as HTMLButtonElement).disabled)) current?.focus({ preventScroll: true });
  }
  private rove(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = this.toolbarButtons(), index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true }); this.syncTabStop();
  }
  private closeMenu() { this.menu.close(false); }
  private openMenu(items: MenuEntry[], clientX: number, clientY: number, invoker: HTMLElement | (() => void)) {
    this.tooltip.hide(); this.closeMenu(); this.menuOpen = true;
    this.buttons.get('more')!.setAttribute('aria-expanded', String(invoker === this.buttons.get('more')));
    const bounds = this.root.getBoundingClientRect();
    this.menu.open(items, (clientX - bounds.left) * this.root.clientWidth / bounds.width,
      (clientY - bounds.top) * this.root.clientHeight / bounds.height, {
        returnFocus: invoker,
        onClose: () => { this.menuOpen = false; this.buttons.get('more')!.setAttribute('aria-expanded', 'false'); },
      });
  }
  private visibilityItem() {
    return { label: this.hidden ? 'Show UI' : 'Hide UI', separatorBefore: true, canExecute: () => true,
      action: () => this.setUIHidden(!this.hidden) };
  }
  private openMore(button: HTMLElement) {
    const width = this.root.clientWidth;
    const entries: MenuEntry[] = overflowActions(this.editor?.getNodeMenuItems() ?? getNodeMenuDescriptors(), width);
    if (width <= 360) {
      const commands = this.editor?.getCommands() ?? getCommandDescriptors();
      for (const id of ['undo', 'redo']) entries.push({ ...commands.find(item => item.id === id)!, separatorBefore: id === 'undo' });
    }
    entries.push(this.visibilityItem());
    if (width <= 650) entries.push(
      { label: 'Keyboard shortcuts', separatorBefore: true, canExecute: () => true, action: () => this.help(button) },
      { label: 'Documentation', canExecute: () => true, action: () => this.documentation() });
    const bounds = button.getBoundingClientRect(); this.openMenu(entries, bounds.left, bounds.bottom, button);
  }
  contextMenu(request: ContextMenuRequest): (restoreFocus: boolean) => void {
    this.openMenu([...request.items, this.visibilityItem()], request.clientX, request.clientY, () => this.focusCanvas());
    return restoreFocus => this.menu.close(restoreFocus);
  }
  private openContext(x: number, y: number) {
    if (!this.finishEdit()) return;
    this.openMenu([...(this.editor?.getNodeMenuItems() ?? getNodeMenuDescriptors()), this.visibilityItem()], x, y, () => this.focusCanvas());
  }
  private setUIHidden(hidden: boolean) {
    this.closeMenu(); this.tooltip.hide(); this.hidden = hidden;
    this.toolbar.hidden = this.status.hidden = hidden;
    this.focusCanvas();
    this.announce(hidden ? 'Toolbar and status bar hidden. Use the context menu to show UI.' : 'Toolbar and status bar shown.');
    this.update();
  }
  private help(invoker: HTMLElement) {
    this.closeMenu(); this.tooltip.hide();
    if (this.closeDialog) return;
    this.closeDialog = shortcutsDialog(this.root, this.mac, () => {
      this.closeDialog = undefined;
      if (this.destroyed) return;
      if (invoker.isConnected && invoker.checkVisibility()) invoker.focus({ preventScroll: true }); else this.focusCanvas();
    });
  }
  private documentation() {
    this.closeMenu(); this.tooltip.hide();
    // Trilium activates the clicked split in its bubbling handler. Cached note
    // lookups can resolve before that handler and let it undo our tab activation.
    clearTimeout(this.documentationTimer);
    this.documentationTimer = setTimeout(() => {
      this.documentationTimer = undefined;
      if (!this.destroyed) void this.options.documentation().catch(() => {
        if (!this.destroyed) this.options.report('Documentation is unavailable for this installation.');
      });
    }, 0);
  }
  private announce(message: string) { this.live.textContent = message; }
  destroy() {
    this.destroyed = true; this.abort.abort(); this.resize.disconnect(); this.closeMenu(); this.tooltip.hide(); this.closeDialog?.();
    for (const unsubscribe of this.subscriptions) unsubscribe();
    clearTimeout(this.documentationTimer); cancelAnimationFrame(this.frame); this.toolbar.replaceChildren(); this.status.replaceChildren(); this.live.remove();
  }
}
