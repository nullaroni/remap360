// Parser, editor and writer for Advantage2 layout files (qwerty.txt, dvorak.txt,
// hotkey layouts). Lines the editor doesn't understand are kept verbatim.
(function (root) {
  "use strict";

  const T = root.A2Tokens || (typeof require !== "undefined" ? require("./tokens.js") : null);

  const TAP_HOLD = /^\[([^\]]+)\]>\[([^\]]+)\]\[t&h(\d{1,3})\]\[([^\]]+)\]$/i;
  const REMAP = /^\[([^\]]+)\]>\[([^\]]+)\]$/;
  const MACRO = /^((?:\{[^{}]+\})+)>((?:\{[^{}]*\})*)$/;

  function braces(s) {
    return (s.match(/\{[^{}]*\}/g) || []).map((x) => x.slice(1, -1));
  }

  /** Parses one line into an entry. */
  function parseLine(text) {
    const line = text.trim();
    if (line === "") return { kind: "blank", text };
    if (line.startsWith("*")) return { kind: "disabled", text };
    let m;
    if ((m = TAP_HOLD.exec(line))) {
      return {
        kind: "taphold", loc: m[1].toLowerCase(), tap: m[2].toLowerCase(),
        delay: parseInt(m[3], 10), hold: m[4].toLowerCase(),
      };
    }
    if ((m = REMAP.exec(line))) return { kind: "remap", loc: m[1].toLowerCase(), action: m[2].toLowerCase() };
    if ((m = MACRO.exec(line))) {
      return {
        kind: "macro",
        trigger: braces(m[1]).map((t) => t.toLowerCase()),
        body: braces(m[2]),
      };
    }
    return { kind: "unknown", text };
  }

  function entryText(e) {
    switch (e.kind) {
      case "remap": return `[${e.loc}]>[${e.action}]`;
      case "taphold": return `[${e.loc}]>[${e.tap}][t&h${e.delay}][${e.hold}]`;
      case "macro": return `${e.trigger.map((t) => `{${t}}`).join("")}>${e.body.map((t) => `{${t}}`).join("")}`;
      default: return e.text;
    }
  }

  /** Problems with an entry, as human-readable strings. */
  function validate(e) {
    const problems = [];
    const loc = (t) => {
      if (T.NOT_PROGRAMMABLE.has(t)) problems.push(`The ${t} key can't be programmed`);
      else if (!T.ALL_LOCATIONS.has(t)) problems.push(`Unknown key location “${t}”`);
    };
    const act = (t) => {
      if (!T.isActionToken(t)) problems.push(`Unknown action “${t}”`);
    };
    if (e.kind === "remap") { loc(e.loc); act(e.action); }
    if (e.kind === "taphold") {
      loc(e.loc); act(e.tap); act(e.hold);
      if (e.delay < 1 || e.delay > 999) problems.push("Tap & hold delay must be 1–999 ms");
    }
    if (e.kind === "macro") {
      e.trigger.forEach(loc);
      const keys = e.trigger.filter((t) => !T.MODIFIER_LOCATIONS.has(t));
      if (keys.length !== 1) problems.push("A macro trigger needs exactly one non-modifier key");
      for (const t of e.body) if (!T.isMacroToken(t)) problems.push(`Unknown macro token “${t}”`);
    }
    if (e.kind === "unknown") problems.push("Not a remap or macro line");
    return problems;
  }

  class LayoutFile {
    constructor(text = "") {
      this.eol = /\r\n/.test(text) ? "\r\n" : text.includes("\n") ? "\n" : "\r\n";
      const lines = text.split(/\r?\n/);
      this.trailingNewline = text === "" || /\r?\n$/.test(text);
      if (this.trailingNewline && lines.length && lines[lines.length - 1] === "") lines.pop();
      this.entries = lines.map(parseLine);
    }

    toString() {
      const body = this.entries.map(entryText).join(this.eol);
      return this.entries.length && this.trailingNewline ? body + this.eol : body;
    }

    clone() {
      return new LayoutFile(this.toString());
    }

    /** Effective programming of a location: the last matching line wins, as on the keyboard. */
    binding(loc) {
      let found = null;
      for (const e of this.entries) {
        if ((e.kind === "remap" || e.kind === "taphold") && e.loc === loc) found = e;
      }
      return found;
    }

    /** Action token currently produced by a location (default if not remapped). */
    actionFor(loc) {
      const b = this.binding(loc);
      if (!b) return T.defaultAction(loc);
      return b.kind === "remap" ? b.action : b.tap;
    }

    macrosFor(loc) {
      return this.entries.filter((e) => e.kind === "macro" && e.trigger.includes(loc));
    }

    singleMacro(loc) {
      return this.entries.find((e) => e.kind === "macro" && e.trigger.length === 1 && e.trigger[0] === loc) || null;
    }

    _replaceBinding(loc, entry) {
      const isBinding = (e) => (e.kind === "remap" || e.kind === "taphold") && e.loc === loc;
      const first = this.entries.findIndex(isBinding);
      const kept = [];
      this.entries.forEach((e, i) => {
        if (!isBinding(e)) kept.push(e);
        else if (i === first && entry) kept.push(entry);
      });
      if (first < 0 && entry) kept.push(entry);
      this.entries = kept;
    }

    /** Remaps a location; remapping to its default action removes the line. */
    setAction(loc, action) {
      action = action.toLowerCase();
      if (action === T.defaultAction(loc)) this._replaceBinding(loc, null);
      else this._replaceBinding(loc, { kind: "remap", loc, action });
    }

    setTapHold(loc, tap, hold, delay) {
      this._replaceBinding(loc, { kind: "taphold", loc, tap: tap.toLowerCase(), hold: hold.toLowerCase(), delay });
    }

    /** Sets (or with an empty body, removes) the macro for a trigger. */
    setMacro(trigger, body) {
      const key = (t) => [...t].sort().join("|");
      const k = key(trigger);
      const idx = this.entries.findIndex((e) => e.kind === "macro" && key(e.trigger) === k);
      if (!body || body.length === 0) {
        if (idx >= 0) this.entries.splice(idx, 1);
        return;
      }
      // Modifiers first, then the key, like the keyboard writes them.
      const ordered = [
        ...trigger.filter((t) => T.MODIFIER_LOCATIONS.has(t)),
        ...trigger.filter((t) => !T.MODIFIER_LOCATIONS.has(t)),
      ];
      const entry = { kind: "macro", trigger: ordered, body: [...body] };
      if (idx >= 0) this.entries[idx] = entry;
      else this.entries.push(entry);
    }

    /** Removes every remap, tap & hold and macro on a location. */
    reset(loc) {
      this._replaceBinding(loc, null);
      this.entries = this.entries.filter((e) => !(e.kind === "macro" && e.trigger.includes(loc)));
    }

    /** Swaps what two locations do (remaps and tap & hold only). */
    swap(a, b) {
      const ba = this.binding(a), bb = this.binding(b);
      const apply = (loc, src, srcLoc) => {
        if (src && src.kind === "taphold") this.setTapHold(loc, src.tap, src.hold, src.delay);
        else this.setAction(loc, src ? src.action : T.defaultAction(srcLoc));
      };
      apply(a, bb, b);
      apply(b, ba, a);
    }

    problems() {
      const out = [];
      this.entries.forEach((e, i) => {
        for (const p of validate(e)) out.push({ line: i + 1, text: entryText(e), problem: p });
      });
      return out;
    }

    stats() {
      let remaps = 0, macros = 0;
      for (const e of this.entries) {
        if (e.kind === "remap" || e.kind === "taphold") remaps++;
        if (e.kind === "macro") macros++;
      }
      return { remaps, macros };
    }
  }

  /** Guesses QWERTY or Dvorak from a layout file name like "q_dvorak.txt". */
  function familyForFilename(name) {
    return /dvorak/i.test(name || "") ? "dvorak" : "qwerty";
  }

  const api = { LayoutFile, parseLine, entryText, validate, familyForFilename };
  root.A2Layout = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
