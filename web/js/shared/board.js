// Keyboard drawing shared by every model: SVG keycaps, selection and drag-to-swap.
(function (root) {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const UNIT = 56;

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function fontSize(text, widthUnits, small) {
    const len = [...(text || "")].length;
    let size;
    if (len <= 2) size = 19;
    else if (len <= 4) size = Math.min(15, (widthUnits * UNIT) / (len * 0.62));
    else size = Math.max(8.5, Math.min(13, (widthUnits * UNIT) / (len * 0.62)));
    return small ? Math.min(size, 11) : size;
  }

  /**
   * Draws keys into an <svg>.
   * keys: [{x, y, w, h, rot, rx, ry, small}] in key units.
   * caps: [{label, corner, shifted, hold, kind, classes, title, ariaLabel, fixed}] aligned with keys.
   */
  function render(svg, { keys, size, caps }) {
    svg.textContent = "";
    const pad = 0.3;
    svg.setAttribute("viewBox", `${-pad * UNIT} ${-pad * UNIT} ${(size.w + pad * 2) * UNIT} ${(size.h + pad * 2) * UNIT}`);
    keys.forEach((geo, i) => {
      const cap = caps[i] || {};
      let transform = `translate(${geo.x * UNIT} ${geo.y * UNIT})`;
      if (geo.rot) transform = `rotate(${geo.rot} ${geo.rx * UNIT} ${geo.ry * UNIT}) ${transform}`;
      const g = el("g", {
        class: ["key", `k-${cap.kind || "default"}`, ...(cap.classes || [])].join(" "),
        transform,
        "data-pos": i,
        tabindex: cap.fixed ? -1 : 0,
        role: "button",
        "aria-label": cap.ariaLabel || cap.label || "",
      }, svg);
      const w = geo.w * UNIT, h = geo.h * UNIT, inset = 2.5;
      el("rect", { class: "cap-bg", x: inset, y: inset, width: w - inset * 2, height: h - inset * 2, rx: 7 }, g);
      el("rect", { class: "cap-top", x: inset + 3, y: inset + 2, width: w - inset * 2 - 6, height: h - inset * 2 - 7, rx: 5 }, g);

      const main = cap.label || "";
      const fs = fontSize(main, geo.w, geo.small);
      const yMain = cap.hold && !geo.small ? h / 2 - 4 + fs * 0.35 : h / 2 - 1 + fs * 0.35;
      el("text", { class: "legend-main", x: w / 2, y: yMain, "font-size": fs }, g).textContent = main;
      if (cap.corner && !geo.small) el("text", { class: "legend-orig", x: 7, y: 15 }, g).textContent = cap.corner;
      if (cap.hold && !geo.small) el("text", { class: "legend-hold", x: w / 2, y: h - 9 }, g).textContent = cap.hold;
      else if (cap.shifted && !geo.small) el("text", { class: "legend-shift", x: w - 8, y: 15 }, g).textContent = cap.shifted;
      if (cap.title) el("title", {}, g).textContent = cap.title;
    });
  }

  /** Click selects, dragging one key onto another swaps them. Bind once per <svg>. */
  function interact(svg, { onSelect, onSwap }) {
    let drag = null;
    const posAt = (x, y) => {
      const k = document.elementFromPoint(x, y)?.closest?.(".key");
      return k && svg.contains(k) ? +k.dataset.pos : null;
    };
    const clearDrop = () => svg.querySelectorAll(".key.drop").forEach((n) => n.classList.remove("drop"));

    svg.addEventListener("pointerdown", (e) => {
      const k = e.target.closest(".key");
      if (!k || e.button !== 0) return;
      drag = { from: +k.dataset.pos, x: e.clientX, y: e.clientY, moved: false };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
        drag.moved = !!onSwap;
        if (drag.moved) svg.classList.add("dragging");
      }
      if (drag.moved) {
        clearDrop();
        const over = posAt(e.clientX, e.clientY);
        if (over != null && over !== drag.from) svg.querySelector(`.key[data-pos="${over}"]`)?.classList.add("drop");
      }
    });
    svg.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const { from, moved } = drag;
      drag = null;
      svg.classList.remove("dragging");
      clearDrop();
      if (!moved) return onSelect(from);
      const to = posAt(e.clientX, e.clientY);
      if (to != null && to !== from) onSwap(from, to);
    });
    svg.addEventListener("keydown", (e) => {
      const k = e.target.closest(".key");
      if (k && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSelect(+k.dataset.pos);
      }
    });
  }

  /** Converts rotated thumb-cluster groups into per-key rotation (used by the Advantage2 drawing). */
  function flattenGroups(geometry, groups) {
    return geometry.map((k) => {
      const g = groups[k.group];
      if (!g) return { x: k.x, y: k.y, w: k.w, h: k.h, small: k.group === "fn" };
      return { x: g.x - (g.originX || 0) + k.x, y: g.y + k.y, w: k.w, h: k.h, rot: g.rotate, rx: g.x, ry: g.y };
    });
  }

  root.Board = { render, interact, flattenGroups, UNIT };
})(typeof globalThis !== "undefined" ? globalThis : this);
