// Original Willow vectors from the reviewed design, on a 20px grid.
const paths: Record<string, string> = {
    undo: '<path d="M6.5 3.5 2.75 7.25 6.5 11M3.5 7.25h8.25a4.5 4.5 0 0 1 0 9H8.5"/>',
    redo: '<path d="m13.5 3.5 3.75 3.75L13.5 11m3-3.75H8.25a4.5 4.5 0 0 0 0 9h3.25"/>',
    child: '<rect x="2.75" y="2.75" width="7.5" height="4.5" rx=".6"/><path d="M6.5 7.5V14h1.75M14.75 11v6m-3-3h6"/>',
    sibling: '<rect x="3.75" y="2.75" width="10.5" height="4.5" rx=".6"/><path d="M4 12.5h4m-4 4h4m6.5-5.5v7m-3.5-3.5h7"/>',
    delete: '<path fill="currentColor" stroke="none" d="M2.6 3.5C1.8 3.1 2.8 2 3.8 2.1C6.3 2.9 9.7 6 12.6 9.7C14.8 12.3 16.5 15.6 17.1 17.6C15.5 16.2 13.5 12.8 10.7 10.1C7.5 7.2 4.5 4.7 2.6 3.5ZM3.4 17.8C2.4 16.5 4.1 13.6 6.8 10.6C10.6 6.4 15.4 2.8 18.7 2C16.4 3.8 13.4 6.2 10.4 9.8C7.8 12.9 6.1 15.5 5.4 17.3C5 18.3 4 18.5 3.4 17.8Z"/>',
    edit: '<path d="m4 12.5 8.5-8.5 3.5 3.5-8.5 8.5-4.25.75L4 12.5ZM10.75 5.75l3.5 3.5"/>',
    checkbox: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="m6 10 2.75 2.75L14.25 7"/>',
    collapse: '<circle cx="10" cy="10" r="7.25"/><path d="M10 6.5v7M6.5 10h7"/>',
    expand: '<circle cx="10" cy="10" r="7.25"/><path d="M10 6.5v7M6.5 10h7"/>',
    help: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.25"/><path d="M5 7.5h.25m3-.0h.25m3 0h.25m3 0h.25M5 10h.25m3 0h.25m3 0h.25m3 0h.25M6.25 13h7.5"/>',
    documentation: '<circle cx="10" cy="10" r="7.25"/><path d="M7.8 7.6a2.3 2.3 0 0 1 4.5 .7c0 1.6-2.3 1.8-2.3 3.4m0 2.5h.01"/>',
    fit: '<path d="M7.5 3H3v4.5M12.5 3H17v4.5M3 12.5V17h4.5M17 12.5V17h-4.5"/>',
    plus: '<path d="M10 3.5v13M3.5 10h13"/>', minus: '<path d="M3.5 10h13"/>',
    down: '<path d="m5.5 8 4.5 4.5L14.5 8"/>'
  };

export function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("willow-icon");
  svg.innerHTML = paths[name] ?? "";
  return svg;
}
