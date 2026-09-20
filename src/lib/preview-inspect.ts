/**
 * Inject click-to-inspect into static HTML preview (фаза E).
 * Same-origin iframe posts pocketstudio-inspect messages to the parent.
 */

export const PREVIEW_INSPECT_SCRIPT = `<script data-pocketstudio-inspect>
(function () {
  if (window.parent === window) return;
  var last = null;
  function cssPath(el) {
    var parts = [];
    var n = el;
    while (n && n.nodeType === 1 && parts.length < 6) {
      var sel = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(sel + "#" + n.id); break; }
      if (n.className && typeof n.className === "string") {
        var c = n.className.trim().split(/\\s+/)[0];
        if (c) sel += "." + c;
      }
      parts.unshift(sel);
      n = n.parentElement;
    }
    return parts.join(" > ");
  }
  function paint(el) {
    if (last && last !== el) last.style.outline = last.getAttribute("data-ps-outline") || "";
    last = el;
    if (!el.getAttribute("data-ps-outline")) {
      el.setAttribute("data-ps-outline", el.style.outline || "");
    }
    el.style.outline = "2px solid #10b981";
  }
  document.addEventListener("click", function (e) {
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    paint(el);
    window.parent.postMessage({
      type: "pocketstudio-inspect",
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: typeof el.className === "string" ? el.className : null,
      text: (el.innerText || "").trim().slice(0, 240)
    }, "*");
  }, true);
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "pocketstudio-reload") location.reload();
  });
})();
</script>`;

export function injectPreviewInspect(html: string): string {
  if (html.includes("data-pocketstudio-inspect")) return html;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${PREVIEW_INSPECT_SCRIPT}</body>`);
  }
  return `${html}\n${PREVIEW_INSPECT_SCRIPT}`;
}
