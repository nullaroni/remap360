// Kinesis Advantage2 (SmartSet) location and action tokens.
// Sources: Advantage2 User's Manual, sections 7.8-7.10 and appendix 13.1/13.2.
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Physical positions. 86 per layer: 18 function-row keys, 56 key-well keys,
  // 12 thumb keys. The Keypad and Program keys can't be programmed, which
  // leaves the 84 locations per layer the manual describes.

  const FN_TOP = [
    "escape", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8",
    "f9", "f10", "f11", "f12", "prtscr", "scroll", "pause", "keypd", "progrm",
  ];
  const FN_KEYPAD = [
    "kp-escape", "kp-lwin", "kp-ralt", "menu", "play", "prev", "next", "calc", "kpshift",
    "kp-f9", "kp-f10", "kp-f11", "kp-f12", "mute", "vol-", "vol+", "keypd", "progrm",
  ];

  // Key wells, row by row: 6 left keys then 6 right keys; the bottom row is 4 + 4.
  const WELL_TOP = {
    qwerty: [
      "=", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "hyphen",
      "tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "\\",
      "caps", "a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'",
      "lshift", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "rshift",
      "`", "intl-\\", "left", "right", "up", "down", "obrack", "cbrack",
    ],
    dvorak: [
      "=", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "hyphen",
      "tab", "'", ",", ".", "p", "y", "f", "g", "c", "r", "l", "/",
      "caps", "a", "o", "e", "u", "i", "d", "h", "t", "n", "s", "\\",
      "lshift", ";", "q", "j", "k", "x", "b", "m", "w", "v", "z", "rshift",
      "`", "intl-\\", "left", "right", "up", "down", "obrack", "cbrack",
    ],
  };

  // Key-well positions whose keypad-layer token isn't simply "kp-" + top token.
  const WELL_KEYPAD_SPECIAL = {
    7: "numlk", 8: "kp=", 9: "kpdiv", 10: "kpmult",
    19: "kp7", 20: "kp8", 21: "kp9", 22: "kpmin",
    31: "kp4", 32: "kp5", 33: "kp6", 34: "kpplus",
    43: "kp1", 44: "kp2", 45: "kp3", 46: "kpenter1",
    49: "kp-insert", 54: "kp.", 55: "kpenter2",
  };

  const THUMB_TOP = [
    "lctrl", "lalt", "rwin", "rctrl",
    "bspace", "delete", "home", "pup",
    "enter", "space", "end", "pdown",
  ];
  const THUMB_KEYPAD_SPECIAL = { 9: "kp0" };

  // Geometry in key units (x, y, w, h); thumb clusters are rotated as groups.
  const GEOMETRY = (function () {
    const g = [];
    // Function row: two groups of 9 small keys.
    for (let i = 0; i < 18; i++) {
      const left = i < 9;
      const x = left ? i * 0.9 : 17.5 - (18 - i) * 0.9 + 0.05;
      g.push({ x, y: 0, w: 0.85, h: 0.62, group: "fn" });
    }
    const leftStagger = [0.3, 0.3, 0.12, 0, 0.12, 0.25];
    const rightStagger = [0.25, 0.12, 0, 0.12, 0.3, 0.3];
    const R = 11.25;
    for (let row = 0; row < 5; row++) {
      if (row < 4) {
        for (let c = 0; c < 6; c++) {
          g.push({
            x: c === 0 ? 0 : 1.25 + (c - 1), y: 1 + row + leftStagger[c],
            w: c === 0 ? 1.25 : 1, h: 1, group: "well",
          });
        }
        for (let c = 0; c < 6; c++) {
          g.push({ x: R + c, y: 1 + row + rightStagger[c], w: c === 5 ? 1.25 : 1, h: 1, group: "well" });
        }
      } else {
        for (let c = 1; c <= 4; c++) g.push({ x: 1.25 + (c - 1), y: 5 + leftStagger[c], w: 1, h: 1, group: "well" });
        for (let c = 1; c <= 4; c++) g.push({ x: R + c, y: 5 + rightStagger[c], w: 1, h: 1, group: "well" });
      }
    }
    // Thumb clusters (order matches THUMB_TOP).
    const L = { group: "thumbL" }, Rt = { group: "thumbR" };
    g.push({ ...L, x: 1, y: 0, w: 1, h: 1 }); // lctrl
    g.push({ ...L, x: 2, y: 0, w: 1, h: 1 }); // lalt
    g.push({ ...Rt, x: 0, y: 0, w: 1, h: 1 }); // rwin
    g.push({ ...Rt, x: 1, y: 0, w: 1, h: 1 }); // rctrl
    g.push({ ...L, x: 0, y: 1, w: 1, h: 2 }); // bspace
    g.push({ ...L, x: 1, y: 1, w: 1, h: 2 }); // delete
    g.push({ ...L, x: 2, y: 1, w: 1, h: 1 }); // home
    g.push({ ...Rt, x: 0, y: 1, w: 1, h: 1 }); // pup
    g.push({ ...Rt, x: 1, y: 1, w: 1, h: 2 }); // enter
    g.push({ ...Rt, x: 2, y: 1, w: 1, h: 2 }); // space
    g.push({ ...L, x: 2, y: 2, w: 1, h: 1 }); // end
    g.push({ ...Rt, x: 0, y: 2, w: 1, h: 1 }); // pdown
    return g;
  })();

  const THUMB_GROUPS = {
    thumbL: { x: 4.7, y: 5.55, rotate: 18 },
    // Mirror of the left cluster: pivots on its top-right corner (3 units wide).
    thumbR: { x: 12.8, y: 5.55, rotate: -18, originX: 3 },
  };

  const NOT_PROGRAMMABLE = new Set(["keypd", "progrm"]);

  /** Location tokens for one layout family and layer, in position order. */
  function locations(family, layer) {
    const well = WELL_TOP[family];
    if (!well) throw new Error(`Unknown layout family: ${family}`);
    if (layer === "top") return [...FN_TOP, ...well, ...THUMB_TOP];
    return [
      ...FN_KEYPAD,
      ...well.map((t, i) => WELL_KEYPAD_SPECIAL[i] || `kp-${t}`),
      ...THUMB_TOP.map((t, i) => THUMB_KEYPAD_SPECIAL[i] || `kp-${t}`),
    ];
  }

  const ALL_LOCATIONS = new Set();
  for (const f of ["qwerty", "dvorak"]) {
    for (const l of ["top", "keypad"]) {
      for (const t of locations(f, l)) if (!NOT_PROGRAMMABLE.has(t)) ALL_LOCATIONS.add(t);
    }
  }

  /** The action a location performs when nothing is remapped. */
  function defaultAction(loc) {
    if (loc === "kp=") return "kp=";
    if (loc === "kpenter2") return "kpenter1";
    if (loc.startsWith("kp-")) return loc.slice(3);
    return loc;
  }

  const MODIFIER_LOCATIONS = new Set([
    "lshift", "rshift", "lctrl", "rctrl", "lalt", "rwin",
    "kp-lshift", "kp-rshift", "kp-lctrl", "kp-rctrl", "kp-lalt", "kp-rwin", "kp-lwin", "kp-ralt",
  ]);

  // ---------------------------------------------------------------------------
  // Action tokens (appendix 13.2). label = keycap legend, name = long name.

  const CATEGORIES = [
    "Letters", "Numbers", "Symbols", "Modifiers", "Editing", "Navigation",
    "Function", "Keypad", "Media", "Mouse", "Special",
  ];

  const ACTIONS = [];
  function a(token, label, name, category, extra) {
    ACTIONS.push({ token, label, name, category, ...(extra || {}) });
  }
  for (const ch of "abcdefghijklmnopqrstuvwxyz") a(ch, ch.toUpperCase(), ch.toUpperCase(), "Letters");
  const shiftedDigits = { 1: "!", 2: "@", 3: "#", 4: "$", 5: "%", 6: "^", 7: "&", 8: "*", 9: "(", 0: ")" };
  for (const d of "1234567890") a(d, d, d, "Numbers", { shifted: shiftedDigits[d] });
  a("hyphen", "-", "Hyphen / Minus", "Symbols", { shifted: "_" });
  a("=", "=", "Equals", "Symbols", { shifted: "+" });
  a("obrack", "[", "Left Bracket", "Symbols", { shifted: "{" });
  a("cbrack", "]", "Right Bracket", "Symbols", { shifted: "}" });
  a("\\", "\\", "Backslash", "Symbols", { shifted: "|" });
  a(";", ";", "Semicolon", "Symbols", { shifted: ":" });
  a("'", "'", "Apostrophe", "Symbols", { shifted: '"' });
  a("`", "`", "Grave / Tilde", "Symbols", { shifted: "~" });
  a(",", ",", "Comma", "Symbols", { shifted: "<" });
  a(".", ".", "Period", "Symbols", { shifted: ">" });
  a("/", "/", "Slash", "Symbols", { shifted: "?" });
  a("intl-\\", "Intl", "International Key", "Symbols");

  a("lshift", "Shift", "Left Shift", "Modifiers", { mod: true });
  a("rshift", "Shift", "Right Shift", "Modifiers", { mod: true });
  a("lctrl", "Ctrl", "Left Ctrl", "Modifiers", { mod: true, mac: "⌃ Ctrl" });
  a("rctrl", "Ctrl", "Right Ctrl", "Modifiers", { mod: true, mac: "⌃ Ctrl" });
  a("lalt", "Alt", "Left Alt", "Modifiers", { mod: true, mac: "⌥ Opt", macName: "Left Option" });
  a("ralt", "Alt", "Right Alt", "Modifiers", { mod: true, mac: "⌥ Opt", macName: "Right Option" });
  a("lwin", "Win", "Left Windows", "Modifiers", { mod: true, mac: "⌘ Cmd", macName: "Left Command" });
  a("rwin", "Win", "Right Windows", "Modifiers", { mod: true, mac: "⌘ Cmd", macName: "Right Command" });
  a("meh", "Meh", "Meh (Ctrl+Alt+Shift)", "Modifiers", { mod: true, macName: "Meh (⌃⌥⇧)" });
  a("hyper", "Hyper", "Hyper (Ctrl+Alt+Shift+Win)", "Modifiers", { mod: true, macName: "Hyper (⌃⌥⇧⌘)" });

  a("escape", "Esc", "Escape", "Editing");
  a("tab", "Tab", "Tab", "Editing");
  a("caps", "Caps", "Caps Lock", "Editing");
  a("enter", "Enter", "Enter", "Editing", { mac: "Return" });
  a("space", "Space", "Space", "Editing");
  a("bspace", "Bksp", "Backspace", "Editing", { mac: "⌫", macName: "Delete (Backspace)" });
  a("delete", "Del", "Delete", "Editing", { mac: "⌦", macName: "Forward Delete" });
  a("insert", "Ins", "Insert", "Editing");
  a("menu", "Menu", "Menu / App", "Editing");

  a("left", "←", "Left Arrow", "Navigation");
  a("right", "→", "Right Arrow", "Navigation");
  a("up", "↑", "Up Arrow", "Navigation");
  a("down", "↓", "Down Arrow", "Navigation");
  a("home", "Home", "Home", "Navigation");
  a("end", "End", "End", "Navigation");
  a("pup", "PgUp", "Page Up", "Navigation");
  a("pdown", "PgDn", "Page Down", "Navigation");

  for (let i = 1; i <= 24; i++) a(`f${i}`, `F${i}`, `F${i}`, "Function");
  a("prtscr", "PrtSc", "Print Screen", "Function");
  a("scroll", "ScrLk", "Scroll Lock", "Function");
  a("pause", "Pause", "Pause / Break", "Function");

  a("numlk", "NumLk", "Num Lock", "Keypad");
  for (let i = 0; i <= 9; i++) a(`kp${i}`, `${i}`, `Keypad ${i}`, "Keypad", { pad: true });
  a("kp.", ".", "Keypad Decimal", "Keypad", { pad: true });
  a("kpdiv", "/", "Keypad Divide", "Keypad", { pad: true });
  a("kpmult", "*", "Keypad Multiply", "Keypad", { pad: true });
  a("kpmin", "-", "Keypad Minus", "Keypad", { pad: true });
  a("kpplus", "+", "Keypad Plus", "Keypad", { pad: true });
  a("kpenter1", "Enter", "Keypad Enter", "Keypad", { pad: true });
  a("kp=mac", "=", "Keypad = (Mac)", "Keypad", { pad: true });

  a("mute", "Mute", "Mute", "Media", { icon: "🔇" });
  a("vol-", "Vol−", "Volume Down", "Media", { icon: "🔉" });
  a("vol+", "Vol+", "Volume Up", "Media", { icon: "🔊" });
  a("play", "Play", "Play / Pause", "Media", { icon: "⏯" });
  a("prev", "Prev", "Previous Track", "Media", { icon: "⏮" });
  a("next", "Next", "Next Track", "Media", { icon: "⏭" });
  a("calc", "Calc", "Calculator (Windows)", "Media");

  a("lmouse", "LClick", "Left Mouse Button", "Mouse");
  a("rmouse", "RClick", "Right Mouse Button", "Mouse");
  a("mmouse", "MClick", "Middle Mouse Button", "Mouse");

  a("null", "—", "No action (disable key)", "Special");
  a("kptoggle", "Keypad", "Keypad Toggle (map on both layers)", "Special");
  a("kpshift", "KP Shift", "Keypad Shift (map on both layers)", "Special");
  a("shutdn", "Power", "Shutdown (Windows: immediate!)", "Special");

  const ACTION_MAP = new Map(ACTIONS.map((x) => [x.token, x]));
  // Display-only entries for default keypad-layer actions without a dictionary token.
  const DISPLAY_ONLY = new Map([
    ["kp=", { token: "kp=", label: "=", name: "Keypad =", category: "Keypad", pad: true }],
    ["keypd", { token: "keypd", label: "Keypad", name: "Keypad layer key (fixed)", category: "Special" }],
    ["progrm", { token: "progrm", label: "Progrm", name: "Program key (fixed)", category: "Special" }],
    ["esc", { token: "esc", label: "Esc", name: "Escape", category: "Editing" }],
  ]);

  const MACRO_META = /^(d125|d500|speed[1-9])$/;

  function isActionToken(t) {
    t = t.toLowerCase();
    return ACTION_MAP.has(t) || t === "esc" || /^\d{1,3}$/.test(t);
  }

  function isMacroToken(t) {
    t = t.toLowerCase();
    if (MACRO_META.test(t)) return true;
    if (/^[-+]./.test(t) && t !== "-" && t !== "+") return isActionToken(t.slice(1));
    return isActionToken(t);
  }

  function describe(token, mac) {
    token = String(token).toLowerCase();
    const def = ACTION_MAP.get(token) || DISPLAY_ONLY.get(token);
    if (def) {
      return {
        ...def,
        label: (mac && def.mac) || def.label,
        name: (mac && def.macName) || def.name,
      };
    }
    if (/^\d{1,3}$/.test(token)) return { token, label: `#${token}`, name: `USB HID usage ${token}`, category: "Special" };
    return { token, label: token, name: token, category: "Special", unknown: true };
  }

  // ---------------------------------------------------------------------------
  // Browser KeyboardEvent.code -> action token (for "press a key" and the test pad).

  const CODE_TO_TOKEN = {
    Minus: "hyphen", Equal: "=", BracketLeft: "obrack", BracketRight: "cbrack", Backslash: "\\",
    Semicolon: ";", Quote: "'", Backquote: "`", Comma: ",", Period: ".", Slash: "/",
    IntlBackslash: "intl-\\", Enter: "enter", Tab: "tab", Space: "space", Backspace: "bspace",
    Delete: "delete", Escape: "escape", Insert: "insert", CapsLock: "caps", ContextMenu: "menu",
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    Home: "home", End: "end", PageUp: "pup", PageDown: "pdown",
    PrintScreen: "prtscr", ScrollLock: "scroll", Pause: "pause", NumLock: "numlk",
    NumpadDecimal: "kp.", NumpadDivide: "kpdiv", NumpadMultiply: "kpmult", NumpadSubtract: "kpmin",
    NumpadAdd: "kpplus", NumpadEnter: "kpenter1", NumpadEqual: "kp=mac",
    ShiftLeft: "lshift", ShiftRight: "rshift", ControlLeft: "lctrl", ControlRight: "rctrl",
    AltLeft: "lalt", AltRight: "ralt", MetaLeft: "lwin", MetaRight: "rwin", OSLeft: "lwin", OSRight: "rwin",
    AudioVolumeMute: "mute", AudioVolumeDown: "vol-", AudioVolumeUp: "vol+",
    MediaPlayPause: "play", MediaTrackNext: "next", MediaTrackPrevious: "prev",
  };

  function tokenForCode(code) {
    if (!code) return null;
    let m;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1].toLowerCase();
    if ((m = /^Digit(\d)$/.exec(code))) return m[1];
    if ((m = /^Numpad(\d)$/.exec(code))) return `kp${m[1]}`;
    if ((m = /^F(\d{1,2})$/.exec(code))) return `f${m[1]}`;
    return CODE_TO_TOKEN[code] || null;
  }

  // ---------------------------------------------------------------------------
  // Text <-> macro tokens (US English, as the manual requires).

  const SHIFTED = {
    "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
    _: "hyphen", "+": "=", "{": "obrack", "}": "cbrack", "|": "\\", ":": ";", '"': "'",
    "<": ",", ">": ".", "?": "/", "~": "`",
  };
  const PLAIN = { "-": "hyphen", "[": "obrack", "]": "cbrack", " ": "space", "\n": "enter", "\t": "tab" };

  /** Converts typed text to macro tokens; returns null if a character can't be typed. */
  function textToMacro(text) {
    const out = [];
    for (const ch of text.replace(/\r\n?/g, "\n")) {
      if (/[a-z0-9=\\;',./`]/.test(ch)) out.push(ch);
      else if (/[A-Z]/.test(ch)) out.push("-lshift", ch.toLowerCase(), "+lshift");
      else if (PLAIN[ch]) out.push(PLAIN[ch]);
      else if (SHIFTED[ch]) out.push("-lshift", SHIFTED[ch], "+lshift");
      else return null;
    }
    return out;
  }

  /** Best-effort reverse of textToMacro; returns null if the macro isn't plain text. */
  function macroToText(tokens) {
    const unshift = {};
    for (const [k, v] of Object.entries(SHIFTED)) unshift[v] = k;
    const plainRev = {};
    for (const [k, v] of Object.entries(PLAIN)) plainRev[v] = k;
    let shift = false;
    let out = "";
    for (const raw of tokens) {
      const t = raw.toLowerCase();
      if (t === "-lshift" || t === "-rshift") { shift = true; continue; }
      if (t === "+lshift" || t === "+rshift") { shift = false; continue; }
      if (/^[a-z]$/.test(t)) out += shift ? t.toUpperCase() : t;
      else if (shift && unshift[t]) out += unshift[t];
      else if (!shift && plainRev[t]) out += plainRev[t];
      else if (!shift && /^[0-9=\\;',./`]$/.test(t)) out += t;
      else return null;
    }
    return out;
  }

  const api = {
    locations, defaultAction, describe, isActionToken, isMacroToken, tokenForCode,
    textToMacro, macroToText,
    ACTIONS, CATEGORIES, GEOMETRY, THUMB_GROUPS, NOT_PROGRAMMABLE, ALL_LOCATIONS, MODIFIER_LOCATIONS,
  };
  root.A2Tokens = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
