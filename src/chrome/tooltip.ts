/** Explicit per-entry timing, independent of native browser title tooltips. */
export class Tooltip {
  private timer?: ReturnType<typeof setTimeout>;
  private anchor?: HTMLElement;
  private tip?: HTMLElement;
  constructor(private root: HTMLElement) {}
  show(anchor: HTMLElement, immediate = false) {
    this.hide();
    this.anchor = anchor;
    const reveal = () => {
      this.timer = undefined;
      if (!anchor.isConnected || !anchor.checkVisibility() || !anchor.dataset.tooltip) return;
      const tip = document.createElement('div');
      tip.className = 'willow-tooltip'; tip.id = `willow-tooltip-${crypto.randomUUID()}`;
      tip.setAttribute('role', 'tooltip'); tip.textContent = anchor.dataset.tooltip;
      const rgb = getComputedStyle(this.root).backgroundColor.match(/[\d.]+/g)?.map(Number);
      tip.dataset.dark = String(!!rgb && (rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722) < 128);
      this.root.append(tip); this.tip = tip;
      anchor.setAttribute('aria-describedby', [anchor.getAttribute('aria-describedby'), tip.id].filter(Boolean).join(' '));
      const box = anchor.getBoundingClientRect(), gap = 6;
      const above = !!anchor.closest('.willow-statusbar');
      const top = above ? box.top - gap - tip.offsetHeight : box.bottom + gap;
      Object.assign(tip.style, {
        left: `${Math.max(8, Math.min(box.left + (box.width - tip.offsetWidth) / 2, innerWidth - tip.offsetWidth - 8))}px`,
        top: `${Math.max(8, Math.min(top, innerHeight - tip.offsetHeight - 8))}px`,
      });
    };
    if (immediate) reveal(); else this.timer = setTimeout(reveal, 200);
  }
  hide() {
    clearTimeout(this.timer); this.timer = undefined;
    if (this.tip && this.anchor) {
      const ids = (this.anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== this.tip!.id);
      if (ids.length) this.anchor.setAttribute('aria-describedby', ids.join(' '));
      else this.anchor.removeAttribute('aria-describedby');
    }
    this.tip?.remove(); this.tip = undefined; this.anchor = undefined;
  }
}
