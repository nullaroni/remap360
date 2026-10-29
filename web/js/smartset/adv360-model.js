// Kinesis Advantage360 (non-Pro, SmartSet engine, KB360) layout files:
// layouts/layout1.txt … layout9.txt on the "ADV360" v-Drive.
// Sources: Advantage360 SmartSet Direct Programming Guide (Feb 2022) and the
// SmartSet Engine Supported Actions token list (Mar 2023).
(function (root) {
  "use strict";

  const Board = root.Board;
  const Geometry = root.Adv360Geometry || (typeof require !== "undefined" ? require("../shared/geometry360.js") : null);

  // Position tokens in keymap order (same 76 positions as the Advantage360 Pro).
  const POSITIONS = [
    "eql", "1", "2", "3", "4", "5", "kp", "ss", "6", "7", "8", "9", "0", "hyph",
    "tab", "q", "w", "e", "r", "t", "hk1", "hk3", "y", "u", "i", "o", "p", "bsls",
    "esc", "a", "s", "d", "f", "g", "hk2", "lctr", "lalt", "rwin", "rctr", "hk4", "h", "j", "k", "l", "scol", "apos",
    "lshf", "z", "x", "c", "v", "b", "home", "pgup", "n", "m", "comm", "perd", "fsls", "rshf",
    "lfn", "grav", "caps", "left", "rght", "bspc", "del", "end", "pgdn", "ent", "spc", "up", "down", "obrk", "cbrk", "rfn",
  ];
  const PEDALS = ["lpd1", "lpd2", "rpd1", "rpd2"];
  const ALL_POSITIONS = new Set([...POSITIONS, ...PEDALS].filter((p) => p !== "ss"));
  const FIXED = new Set(["ss"]);

  const LAYERS = [
    { id: "base", name: "Base" },
    { id: "keypad", name: "Keypad" },
    { id: "function1", name: "Fn" },
    { id: "function2", name: "Fn2" },
    { id: "function3", name: "Fn3" },
  ];
  const LAYER_IDS = new Set(LAYERS.map((l) => l.id));

  // Built-in actions that differ from the base layer (as printed on the keycaps).
  const LAYER_DEFAULTS = {
    keypad: {
      7: "nmlk", 8: "kp=", 9: "kp/", 0: "kp*", u: "kp7", i: "kp8", o: "kp9", p: "kp-",
      j: "kp4", k: "kp5", l: "kp6", scol: "kp+", m: "kp1", comm: "kp2", perd: "kp3", fsls: "kpen",
      spc: "kp0", obrk: "kp.",
    },
    function1: {
      eql: "f1", 1: "f2", 2: "f3", 3: "f4", 4: "f5", 5: "f6",
      6: "f7", 7: "f8", 8: "f9", 9: "f10", 0: "f11", hyph: "f12",
    },
  };
  const BASE_DEFAULTS = { kp: "keyt", lfn: "fn1s", rfn: "fn1s", hk1: "null", hk2: "null", hk3: "null", hk4: "null" };

  function defaultAction(loc, layer) {
    const d = LAYER_DEFAULTS[layer];
    if (d && d[loc]) return d[loc];
    return BASE_DEFAULTS[loc] || loc;
  }

  const ALIASES = { lctrl: "lctr", rctrl: "rctr", lshft: "lshf", rshft: "rshf", lshift: "lshf", rshift: "rshf", escape: "esc" };
  const canon = (t) => {
    t = String(t).toLowerCase();
    return ALIASES[t] || t;
  };

  // ---------------------------------------------------------------------------
  // Action tokens

  const CATEGORIES = ["Letters", "Numbers", "Symbols", "Modifiers", "Editing", "Navigation", "Function",
    "Keypad", "Media", "Mouse", "Layers", "Special"];
  const ACTIONS = [];
  const a = (token, label, name, category, extra) => ACTIONS.push({ token, label, name, category, ...(extra || {}) });

  for (const ch of "abcdefghijklmnopqrstuvwxyz") a(ch, ch.toUpperCase(), ch.toUpperCase(), "Letters");
  const shiftedDigits = { 1: "!", 2: "@", 3: "#", 4: "$", 5: "%", 6: "^", 7: "&", 8: "*", 9: "(", 0: ")" };
  for (const d of "1234567890") a(d, d, d, "Numbers", { shifted: shiftedDigits[d] });
  a("hyph", "-", "Hyphen / Minus", "Symbols", { shifted: "_" });
  a("eql", "=", "Equals", "Symbols", { shifted: "+" });
  a("obrk", "[", "Left Bracket", "Symbols", { shifted: "{" });
  a("cbrk", "]", "Right Bracket", "Symbols", { shifted: "}" });
  a("bsls", "\\", "Backslash", "Symbols", { shifted: "|" });
  a("scol", ";", "Semicolon", "Symbols", { shifted: ":" });
  a("apos", "'", "Apostrophe", "Symbols", { shifted: '"' });
  a("grav", "`", "Grave / Tilde", "Symbols", { shifted: "~" });
  a("comm", ",", "Comma", "Symbols", { shifted: "<" });
  a("perd", ".", "Period", "Symbols", { shifted: ">" });
  a("fsls", "/", "Slash", "Symbols", { shifted: "?" });
  a("int\\", "Intl\\", "International Backslash", "Symbols");
  a("int#", "Intl#", "International Hash", "Symbols");

  a("lshf", "Shift", "Left Shift", "Modifiers", { mod: true });
  a("rshf", "Shift", "Right Shift", "Modifiers", { mod: true });
  a("lctr", "Ctrl", "Left Ctrl", "Modifiers", { mod: true, mac: "⌃ Ctrl" });
  a("rctr", "Ctrl", "Right Ctrl", "Modifiers", { mod: true, mac: "⌃ Ctrl" });
  a("lalt", "Alt", "Left Alt", "Modifiers", { mod: true, mac: "⌥ Opt", macName: "Left Option" });
  a("ralt", "Alt", "Right Alt", "Modifiers", { mod: true, mac: "⌥ Opt", macName: "Right Option" });
  a("lwin", "Win", "Left Windows", "Modifiers", { mod: true, mac: "⌘ Cmd", macName: "Left Command" });
  a("rwin", "Win", "Right Windows", "Modifiers", { mod: true, mac: "⌘ Cmd", macName: "Right Command" });
  a("hypr", "Hyper", "Hyper (Ctrl+Alt+Win+Shift)", "Modifiers", { mod: true });
  a("meh", "Meh", "Meh (Ctrl+Alt+Shift)", "Modifiers", { mod: true });
  // Multi-modifier combos from Kinesis' token list (token letters: c=Ctrl, a=Alt, w=Win, s=Shift).
  for (const [t, label, name] of [
    ["caws", "C+A+W+S", "Ctrl+Alt+Win+Shift"], ["xaws", "C+A+W", "Ctrl+Alt+Win"],
    ["cxws", "C+W+S", "Ctrl+Win+Shift"], ["caxs", "C+A+S", "Ctrl+Alt+Shift"], ["cawx", "A+W+S", "Alt+Win+Shift"],
    ["caxx", "C+A", "Ctrl+Alt"], ["cxwx", "C+W", "Ctrl+Win"], ["cxxs", "C+S", "Ctrl+Shift"],
    ["xawx", "A+W", "Alt+Win"], ["xaxs", "A+S", "Alt+Shift"], ["xxws", "W+S", "Win+Shift"],
  ]) a(t, label, name, "Modifiers", { mod: true });

  a("esc", "Esc", "Escape", "Editing");
  a("tab", "Tab", "Tab", "Editing");
  a("caps", "Caps", "Caps Lock", "Editing");
  a("ent", "Enter", "Enter", "Editing", { mac: "Return" });
  a("spc", "Space", "Space", "Editing");
  a("bspc", "Bksp", "Backspace", "Editing", { mac: "⌫", macName: "Delete (Backspace)" });
  a("del", "Del", "Delete", "Editing", { mac: "⌦", macName: "Forward Delete" });
  a("ins", "Ins", "Insert", "Editing");
  a("app", "Menu", "Application / Menu", "Editing");

  a("left", "←", "Left Arrow", "Navigation");
  a("rght", "→", "Right Arrow", "Navigation");
  a("up", "↑", "Up Arrow", "Navigation");
  a("down", "↓", "Down Arrow", "Navigation");
  a("home", "Home", "Home", "Navigation");
  a("end", "End", "End", "Navigation");
  a("pgup", "PgUp", "Page Up", "Navigation");
  a("pgdn", "PgDn", "Page Down", "Navigation");

  for (let i = 1; i <= 24; i++) a(`f${i}`, `F${i}`, `F${i}`, "Function");
  a("prnt", "PrtSc", "Print Screen", "Function");
  a("sclk", "ScrLk", "Scroll Lock", "Function");
  a("paus", "Pause", "Pause", "Function");

  a("nmlk", "NumLk", "Num Lock", "Keypad");
  for (let i = 0; i <= 9; i++) a(`kp${i}`, `${i}`, `Keypad ${i}`, "Keypad");
  a("kp.", ".", "Keypad Decimal", "Keypad");
  a("kp/", "/", "Keypad Divide", "Keypad");
  a("kp*", "*", "Keypad Multiply", "Keypad");
  a("kp-", "-", "Keypad Minus", "Keypad");
  a("kp+", "+", "Keypad Plus", "Keypad");
  a("kpen", "Enter", "Keypad Enter", "Keypad");
  a("kp=", "=", "Keypad Equals", "Keypad");

  a("mute", "Mute", "Mute", "Media");
  a("vol-", "Vol−", "Volume Down", "Media");
  a("vol+", "Vol+", "Volume Up", "Media");
  a("plpa", "Play", "Play / Pause", "Media");
  a("next", "Next", "Next Track", "Media");
  a("prev", "Prev", "Previous Track", "Media");
  a("stop", "Stop", "Stop", "Media");
  a("fwrd", "FFwd", "Fast Forward", "Media");
  a("rewd", "Rew", "Rewind", "Media");
  a("ejct", "Eject", "Eject", "Media");
  a("calc", "Calc", "Calculator", "Media");

  a("lmou", "LClick", "Left Mouse Button", "Mouse");
  a("rmou", "RClick", "Right Mouse Button", "Mouse");
  a("mmou", "MClick", "Middle Mouse Button", "Mouse");
  a("4mou", "Back", "Mouse Button 4", "Mouse");
  a("5mou", "Fwd", "Mouse Button 5", "Mouse");
  a("sumo", "Scroll↑", "Scroll Up", "Mouse");
  a("sdmo", "Scroll↓", "Scroll Down", "Mouse");
  a("moul", "Mouse←", "Move Mouse Left", "Mouse");
  a("mour", "Mouse→", "Move Mouse Right", "Mouse");
  a("mouu", "Mouse↑", "Move Mouse Up", "Mouse");
  a("moud", "Mouse↓", "Move Mouse Down", "Mouse");

  a("keys", "KP", "Keypad layer (hold)", "Layers");
  a("keyt", "Keypad", "Keypad layer (toggle)", "Layers");
  a("fn1s", "Fn", "Fn layer (hold)", "Layers");
  a("fn1t", "Fn ⇄", "Fn layer (toggle)", "Layers");
  a("fn2s", "Fn2", "Fn2 layer (hold)", "Layers");
  a("fn2t", "Fn2 ⇄", "Fn2 layer (toggle)", "Layers");
  a("fn3s", "Fn3", "Fn3 layer (hold)", "Layers");
  a("fn3t", "Fn3 ⇄", "Fn3 layer (toggle)", "Layers");
  a("defs", "Base", "Base layer (hold)", "Layers");
  a("deft", "Base ⇄", "Base layer (toggle)", "Layers");

  a("null", "—", "No action (disable key)", "Special");
  for (let i = 0; i <= 9; i++) a(`pro${i}`, `P${i}`, `Load profile ${i}`, "Special");
  a("ledt", "LED", "LEDs on/off", "Special");
  a("led+", "LED+", "LED brightness up", "Special");
  a("led-", "LED−", "LED brightness down", "Special");
  a("mstp", "MStop", "Stop macro playback", "Special");
  a("powr", "Power", "Power", "Special");
  a("ss", "SmartSet", "SmartSet key", "Special");

  const ACTION_MAP = new Map(ACTIONS.map((x) => [x.token, x]));
  const LOCATION_ONLY = {
    kp: { label: "Keypad", name: "Keypad key" },
    lfn: { label: "Fn", name: "Left Fn key" },
    rfn: { label: "Fn", name: "Right Fn key" },
    hk1: { label: "Hk1", name: "Hotkey 1" },
    hk2: { label: "Hk2", name: "Hotkey 2" },
    hk3: { label: "Hk3", name: "Hotkey 3" },
    hk4: { label: "Hk4", name: "Hotkey 4" },
    ss: { label: "SmartSet", name: "SmartSet key" },
    lpd1: { label: "LP1", name: "Left pedal 1" },
    lpd2: { label: "LP2", name: "Left pedal 2" },
    rpd1: { label: "RP1", name: "Right pedal 1" },
    rpd2: { label: "RP2", name: "Right pedal 2" },
  };

  function isActionToken(t) {
    t = canon(t);
    return ACTION_MAP.has(t) || /^kh[0-9a-f]{2}$/.test(t) || /^int[1-9]$/.test(t) || /^lng[1-9]$/.test(t);
  }

  function isMacroToken(t) {
    t = canon(t);
    if (/^(s[1-9]|x[1-9]|d\d{3}|dran)$/.test(t)) return true;
    if (/^[-+]./.test(t) && t.length > 1 && !ACTION_MAP.has(t)) return isActionToken(t.slice(1));
    return isActionToken(t);
  }

  function describe(token, mac) {
    token = canon(token);
    const def = ACTION_MAP.get(token);
    if (def) return { ...def, label: (mac && def.mac) || def.label, name: (mac && def.macName) || def.name };
    return { token, label: token, name: token, category: "Special", unknown: true };
  }

  function locationName(loc, layer, mac) {
    if (LOCATION_ONLY[loc]) return LOCATION_ONLY[loc].name;
    return describe(defaultAction(loc, "base"), mac).name;
  }

  function locationLabel(loc, mac) {
    if (LOCATION_ONLY[loc]) return LOCATION_ONLY[loc].label;
    return describe(loc, mac).label;
  }

  const MODIFIERS = new Set(["lshf", "rshf", "lctr", "rctr", "lalt", "ralt", "lwin", "rwin"]);

  // ---------------------------------------------------------------------------
  // Browser key → action token, and text → macro tokens

  const CODE_TO_TOKEN = {
    Minus: "hyph", Equal: "eql", BracketLeft: "obrk", BracketRight: "cbrk", Backslash: "bsls",
    Semicolon: "scol", Quote: "apos", Backquote: "grav", Comma: "comm", Period: "perd", Slash: "fsls",
    IntlBackslash: "int\\", Enter: "ent", Tab: "tab", Space: "spc", Backspace: "bspc", Delete: "del",
    Escape: "esc", Insert: "ins", CapsLock: "caps", ContextMenu: "app",
    ArrowLeft: "left", ArrowRight: "rght", ArrowUp: "up", ArrowDown: "down",
    Home: "home", End: "end", PageUp: "pgup", PageDown: "pgdn",
    PrintScreen: "prnt", ScrollLock: "sclk", Pause: "paus", NumLock: "nmlk",
    NumpadDecimal: "kp.", NumpadDivide: "kp/", NumpadMultiply: "kp*", NumpadSubtract: "kp-",
    NumpadAdd: "kp+", NumpadEnter: "kpen", NumpadEqual: "kp=",
    ShiftLeft: "lshf", ShiftRight: "rshf", ControlLeft: "lctr", ControlRight: "rctr",
    AltLeft: "lalt", AltRight: "ralt", MetaLeft: "lwin", MetaRight: "rwin", OSLeft: "lwin", OSRight: "rwin",
    AudioVolumeMute: "mute", AudioVolumeDown: "vol-", AudioVolumeUp: "vol+",
    MediaPlayPause: "plpa", MediaTrackNext: "next", MediaTrackPrevious: "prev", MediaStop: "stop",
  };
  function tokenForCode(code) {
    let m;
    if (!code) return null;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1].toLowerCase();
    if ((m = /^Digit(\d)$/.exec(code))) return m[1];
    if ((m = /^Numpad(\d)$/.exec(code))) return `kp${m[1]}`;
    if ((m = /^F(\d{1,2})$/.exec(code))) return `f${m[1]}`;
    return CODE_TO_TOKEN[code] || null;
  }

  const CHAR_TOKENS = {
    "-": "hyph", "=": "eql", "[": "obrk", "]": "cbrk", "\\": "bsls", ";": "scol", "'": "apos", "`": "grav",
    ",": "comm", ".": "perd", "/": "fsls", " ": "spc", "\n": "ent", "\t": "tab",
  };
  const SHIFTED = {
    "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
    _: "hyph", "+": "eql", "{": "obrk", "}": "cbrk", "|": "bsls", ":": "scol", '"': "apos",
    "<": "comm", ">": "perd", "?": "fsls", "~": "grav",
  };

  function textToMacro(text) {
    const out = [];
    for (const ch of text.replace(/\r\n?/g, "\n")) {
      if (/[a-z0-9]/.test(ch)) out.push(ch);
      else if (/[A-Z]/.test(ch)) out.push("-lshf", ch.toLowerCase(), "+lshf");
      else if (CHAR_TOKENS[ch]) out.push(CHAR_TOKENS[ch]);
      else if (SHIFTED[ch]) out.push("-lshf", SHIFTED[ch], "+lshf");
      else return null;
    }
    return out;
  }

  function macroToText(tokens) {
    const plain = Object.fromEntries(Object.entries(CHAR_TOKENS).map(([k, v]) => [v, k]));
    const shifted = Object.fromEntries(Object.entries(SHIFTED).map(([k, v]) => [v, k]));
    let shift = false, out = "";
    for (const raw of tokens) {
      const t = canon(raw);
      if (t === "-lshf" || t === "-rshf" || t === "-lshft" || t === "-rshft") { shift = true; continue; }
      if (t === "+lshf" || t === "+rshf" || t === "+lshft" || t === "+rshft") { shift = false; continue; }
      if (/^[a-z]$/.test(t)) out += shift ? t.toUpperCase() : t;
      else if (shift && shifted[t]) out += shifted[t];
      else if (!shift && /^[0-9]$/.test(t)) out += t;
      else if (!shift && plain[t]) out += plain[t];
      else return null;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Layout file with <layer> sections

  const HEADER = /^<\s*([a-z0-9]+)\s*>$/i;
  const TAP_HOLD = /^\[([^\]]+)\]>\[([^\]]+)\]\[t&h(\d{1,3})\]\[([^\]]+)\]$/i;
  const REMAP = /^\[([^\]]+)\]>\[([^\]]+)\]$/;
  const MACRO = /^((?:\{[^{}]+\})+)>((?:\{[^{}]*\})*)$/;
  const braces = (s) => (s.match(/\{[^{}]*\}/g) || []).map((x) => x.slice(1, -1));

  function parseLine(text) {
    const line = text.trim();
    let m;
    if (line === "") return { kind: "blank", text };
    if (line.startsWith("*")) return { kind: "disabled", text };
    if ((m = HEADER.exec(line))) return { kind: "header", layer: m[1].toLowerCase(), text };
    if ((m = TAP_HOLD.exec(line))) {
      return { kind: "taphold", loc: canon(m[1]), tap: canon(m[2]), delay: parseInt(m[3], 10), hold: canon(m[4]) };
    }
    if ((m = REMAP.exec(line))) return { kind: "remap", loc: canon(m[1]), action: canon(m[2]) };
    if ((m = MACRO.exec(line))) return { kind: "macro", trigger: braces(m[1]).map(canon), body: braces(m[2]) };
    return { kind: "unknown", text };
  }

  function entryText(e) {
    switch (e.kind) {
      case "header": return e.text || `<${e.layer}>`;
      case "remap": return `[${e.loc}]>[${e.action}]`;
      case "taphold": return `[${e.loc}]>[${e.tap}][t&h${e.delay}][${e.hold}]`;
      case "macro": return `${e.trigger.map((t) => `{${t}}`).join("")}>${e.body.map((t) => `{${t}}`).join("")}`;
      default: return e.text;
    }
  }

  function validate(e) {
    const problems = [];
    const loc = (t) => {
      if (FIXED.has(t)) problems.push("The SmartSet key can't be programmed");
      else if (!ALL_POSITIONS.has(t)) problems.push(`Unknown key position “${t}”`);
    };
    const act = (t) => { if (!isActionToken(t)) problems.push(`Unknown action “${t}”`); };
    if (e.kind === "header" && !LAYER_IDS.has(e.layer)) problems.push(`Unknown layer <${e.layer}>`);
    if (e.kind === "remap") { loc(e.loc); act(e.action); }
    if (e.kind === "taphold") {
      loc(e.loc); act(e.tap); act(e.hold);
      if (e.delay < 1 || e.delay > 999) problems.push("Tap & hold delay must be 1–999 ms");
    }
    if (e.kind === "macro") {
      e.trigger.forEach(loc);
      if (e.trigger.filter((t) => !MODIFIERS.has(t)).length !== 1) problems.push("A macro trigger needs exactly one non-modifier key");
      for (const t of e.body) if (!isMacroToken(t)) problems.push(`Unknown macro token “${t}”`);
    }
    if (e.kind === "unknown") problems.push("Not a layer header, remap or macro line");
    return problems;
  }

  class Adv360File {
    constructor(text = "") {
      this.eol = /\r\n/.test(text) ? "\r\n" : text.includes("\n") ? "\n" : "\r\n";
      this.trailingNewline = text === "" || /\r?\n$/.test(text);
      const lines = text.split(/\r?\n/);
      if (this.trailingNewline && lines[lines.length - 1] === "") lines.pop();
      this.entries = lines.map(parseLine);
    }

    toString() {
      const body = this.entries.map(entryText).join(this.eol);
      return this.entries.length && this.trailingNewline ? body + this.eol : body;
    }

    clone() { return new Adv360File(this.toString()); }

    /** Entries tagged with the layer they belong to (lines before any header count as base). */
    *_tagged() {
      let layer = "base";
      for (let i = 0; i < this.entries.length; i++) {
        const e = this.entries[i];
        if (e.kind === "header") layer = e.layer;
        yield { e, i, layer };
      }
    }

    _isBinding(e, loc) { return (e.kind === "remap" || e.kind === "taphold") && e.loc === loc; }

    binding(layer, loc) {
      let found = null;
      for (const { e, layer: l } of this._tagged()) if (l === layer && this._isBinding(e, loc)) found = e;
      return found;
    }

    actionFor(layer, loc) {
      const b = this.binding(layer, loc);
      if (!b) return defaultAction(loc, layer);
      return b.kind === "remap" ? b.action : b.tap;
    }

    macrosFor(layer, loc) {
      return [...this._tagged()].filter(({ e, layer: l }) => l === layer && e.kind === "macro" && e.trigger.includes(loc)).map((x) => x.e);
    }

    singleMacro(layer, loc) {
      return this.macrosFor(layer, loc).find((e) => e.trigger.length === 1) || null;
    }

    /** Index to insert a new line at the end of a layer section, adding the header if needed. */
    _sectionEnd(layer) {
      let end = -1;
      for (const { e, i, layer: l } of this._tagged()) {
        if (l === layer && (e.kind !== "blank" || end >= 0)) end = i;
        if (e.kind === "header" && e.layer === layer) end = i;
      }
      if (end >= 0) {
        // Skip back over trailing blank lines in the section.
        while (end > 0 && this.entries[end].kind === "blank") end--;
        return end + 1;
      }
      const headerless = layer === "base" && !this.entries.some((e) => e.kind === "header") && this.entries.some((e) => e.kind !== "blank");
      if (headerless) return this.entries.length;
      this.entries.push({ kind: "header", layer });
      return this.entries.length;
    }

    _replace(layer, match, entry) {
      const hits = [...this._tagged()].filter(({ e, layer: l }) => l === layer && match(e)).map((x) => x.i);
      if (hits.length && entry) this.entries[hits[0]] = entry;
      const drop = new Set(entry ? hits.slice(1) : hits);
      this.entries = this.entries.filter((_, i) => !drop.has(i));
      if (!hits.length && entry) this.entries.splice(this._sectionEnd(layer), 0, entry);
    }

    setAction(layer, loc, action) {
      action = canon(action);
      const entry = action === defaultAction(loc, layer) ? null : { kind: "remap", loc, action };
      this._replace(layer, (e) => this._isBinding(e, loc), entry);
    }

    setTapHold(layer, loc, tap, hold, delay) {
      this._replace(layer, (e) => this._isBinding(e, loc), { kind: "taphold", loc, tap: canon(tap), hold: canon(hold), delay });
    }

    setMacro(layer, trigger, body) {
      const key = (t) => [...t].sort().join("|");
      const k = key(trigger);
      // The guide writes the trigger key first, then any modifier co-triggers.
      const ordered = [...trigger.filter((t) => !MODIFIERS.has(t)), ...trigger.filter((t) => MODIFIERS.has(t))];
      const entry = body && body.length ? { kind: "macro", trigger: ordered, body: [...body] } : null;
      this._replace(layer, (e) => e.kind === "macro" && key(e.trigger) === k, entry);
    }

    reset(layer, loc) {
      this._replace(layer, (e) => this._isBinding(e, loc) || (e.kind === "macro" && e.trigger.includes(loc)), null);
    }

    swap(layer, a, b) {
      const ba = this.binding(layer, a), bb = this.binding(layer, b);
      const apply = (loc, src, srcLoc) => {
        if (src && src.kind === "taphold") this.setTapHold(layer, loc, src.tap, src.hold, src.delay);
        else this.setAction(layer, loc, src ? src.action : defaultAction(srcLoc, layer));
      };
      apply(a, bb, b);
      apply(b, ba, a);
    }

    problems() {
      const out = [];
      this.entries.forEach((e, i) => { for (const p of validate(e)) out.push({ line: i + 1, text: entryText(e), problem: p }); });
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

  // ---------------------------------------------------------------------------
  // Model description for the shared SmartSet editor

  const model = {
    id: "adv360",
    name: "Advantage360",
    shortName: "Advantage360",
    layers: LAYERS,
    families: null,
    familyForFilename: () => null,
    locations: () => POSITIONS,
    keys: Geometry ? Geometry.keys : [],
    size: { w: 18, h: 7.85 },
    isFixed: (loc) => FIXED.has(loc),
    defaultAction,
    locationName,
    locationLabel,
    describe,
    ACTIONS,
    CATEGORIES,
    isMacroToken,
    tokenForCode,
    textToMacro,
    macroToText,
    isModifierLocation: (loc) => MODIFIERS.has(loc),
    modifierLocations: () => ["lshf", "rshf", "lctr", "rctr", "lalt", "rwin"],
    newFile: (text) => new Adv360File(text),
    nullToken: "null",
    drive: {
      label: "ADV360",
      folder: "layouts",
      isLayoutFile: (name) => /\.txt$/i.test(name),
      rank: (name) => {
        const m = /^layout(\d)\.txt$/i.exec(name);
        return m ? +m[1] : 100;
      },
      defaultFileName: "layout1.txt",
    },
    presets: [
      {
        id: "mac", label: "Mac thumb keys (⌘ ⌥ ⌃ ⌘)",
        apply: (f) => {
          for (const [loc, to] of Object.entries({ lctr: "lwin", rwin: "rctr", rctr: "rwin" })) {
            for (const layer of ["base", "keypad", "function1"]) f.setAction(layer, loc, to);
          }
        },
      },
      { id: "caps-ctrl", label: "Caps Lock → Ctrl", apply: (f) => f.setAction("base", "caps", "lctr") },
      { id: "caps-esc", label: "Caps Lock: tap Esc, hold Ctrl", apply: (f) => f.setTapHold("base", "caps", "esc", "lctr", 250) },
      { id: "no-caps", label: "Disable Caps Lock", apply: (f) => f.setAction("base", "caps", "null") },
    ],
    macroHelp: "Extra tokens: <code>{d001}</code>–<code>{d999}</code> delay in ms, <code>{dran}</code> random delay, <code>{s1}</code>–<code>{s9}</code> speed, <code>{x1}</code>–<code>{x9}</code> play count, <code>{-lshf}</code>/<code>{+lshf}</code> hold/release.",
    macroModsFirst: false,
    helpSteps: [
      "Connect the v-Drive: hold the <kbd>SmartSet</kbd> key and tap the key with the <b>v-Drive</b> legend. A drive named <b>ADV360</b> appears.",
      "Click <b>Open v-Drive…</b> and choose the drive (or its <b>layouts</b> folder). Allow editing when the browser asks.",
      "Pick the profile's file (<b>layout1.txt</b>–<b>layout9.txt</b>), change keys, then click <b>Save</b>.",
      "Push the changes to the keyboard: hold <kbd>SmartSet</kbd> and tap the key with the <b>Refresh</b> legend. Then <b>eject</b> the drive and disconnect the v-Drive with the same shortcut you used to connect it.",
    ],
    layerNote: "Keys you haven't changed on the Keypad and Fn layers show the printed keycap legends; Fn2 and Fn3 start out like the base layer.",
  };

  const api = { model, Adv360File, parseLine, validate, POSITIONS, defaultAction, isActionToken, textToMacro, macroToText, tokenForCode };
  root.Adv360SmartSet = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
