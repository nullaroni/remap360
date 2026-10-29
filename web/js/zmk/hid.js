// ZMK key names, HID usage values and legends for the Advantage360 Pro.
// A port of Sources/Remap360Core/{Keycodes,HIDUsage}.swift.
(function (root) {
  "use strict";

  const CATEGORIES = ["Letters", "Numbers", "Symbols", "Shifted Symbols", "Modifiers", "Editing", "Navigation",
    "Function", "Keypad", "Media", "Mac Shortcuts"];

  // [code, label, name, category, page, usage, browserCode, aliases]
  const KEYS = [];
  const k = (code, label, name, category, page, usage, browser, aliases = []) =>
    KEYS.push({ code, label, name, category, page, usage, browser, aliases });

  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c, i) => k(c, c, `Letter ${c}`, "Letters", 7, 0x04 + i, `Key${c}`));
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((n, i) => k(`N${n}`, `${n}`, `Number ${n}`, "Numbers", 7, 0x1e + i, `Digit${n}`, [`NUMBER_${n}`]));
  k("MINUS", "-", "Minus", "Symbols", 7, 0x2d, "Minus");
  k("EQUAL", "=", "Equal", "Symbols", 7, 0x2e, "Equal", ["EQL"]);
  k("LBKT", "[", "Left Bracket", "Symbols", 7, 0x2f, "BracketLeft", ["LEFT_BRACKET"]);
  k("RBKT", "]", "Right Bracket", "Symbols", 7, 0x30, "BracketRight", ["RIGHT_BRACKET"]);
  k("BSLH", "\\", "Backslash", "Symbols", 7, 0x31, "Backslash", ["BACKSLASH"]);
  k("SEMI", ";", "Semicolon", "Symbols", 7, 0x33, "Semicolon", ["SEMICOLON", "SCLN"]);
  k("SQT", "'", "Quote", "Symbols", 7, 0x34, "Quote", ["SINGLE_QUOTE", "APOSTROPHE", "APOS"]);
  k("GRAVE", "`", "Grave", "Symbols", 7, 0x35, "Backquote");
  k("COMMA", ",", "Comma", "Symbols", 7, 0x36, "Comma");
  k("DOT", ".", "Period", "Symbols", 7, 0x37, "Period", ["PERIOD"]);
  k("FSLH", "/", "Slash", "Symbols", 7, 0x38, "Slash", ["SLASH"]);
  k("NON_US_BSLH", "§", "ISO Backslash", "Symbols", 7, 0x64, "IntlBackslash", ["NUBS"]);

  const SHIFTED = [
    ["EXCL", "!", "Exclamation", "N1"], ["AT", "@", "At", "N2"], ["HASH", "#", "Hash", "N3"], ["DLLR", "$", "Dollar", "N4"],
    ["PRCNT", "%", "Percent", "N5"], ["CARET", "^", "Caret", "N6"], ["AMPS", "&", "Ampersand", "N7"], ["STAR", "*", "Asterisk", "N8"],
    ["LPAR", "(", "Left Paren", "N9"], ["RPAR", ")", "Right Paren", "N0"], ["UNDER", "_", "Underscore", "MINUS"],
    ["PLUS", "+", "Plus", "EQUAL"], ["LBRC", "{", "Left Brace", "LBKT"], ["RBRC", "}", "Right Brace", "RBKT"],
    ["PIPE", "|", "Pipe", "BSLH"], ["COLON", ":", "Colon", "SEMI"], ["DQT", "\"", "Double Quote", "SQT"],
    ["TILDE", "~", "Tilde", "GRAVE"], ["LT", "<", "Less Than", "COMMA"], ["GT", ">", "Greater Than", "DOT"],
    ["QMARK", "?", "Question", "FSLH"],
  ];
  const SHIFT_BASE = {};
  for (const [code, label, name, base] of SHIFTED) {
    KEYS.push({ code, label, name, category: "Shifted Symbols", shiftOf: base, aliases: [] });
    SHIFT_BASE[code] = base;
  }

  k("LSHFT", "⇧", "Left Shift", "Modifiers", 7, 0xe1, "ShiftLeft", ["LSHIFT", "LEFT_SHIFT"]);
  k("LCTRL", "⌃", "Left Control", "Modifiers", 7, 0xe0, "ControlLeft", ["LCTL", "LEFT_CONTROL"]);
  k("LALT", "⌥", "Left Option", "Modifiers", 7, 0xe2, "AltLeft", ["LEFT_ALT", "LOPT"]);
  k("LGUI", "⌘", "Left Command", "Modifiers", 7, 0xe3, "MetaLeft", ["LCMD", "LWIN", "LMETA", "LEFT_GUI", "LEFT_WIN", "LEFT_COMMAND"]);
  k("RSHFT", "⇧", "Right Shift", "Modifiers", 7, 0xe5, "ShiftRight", ["RSHIFT", "RIGHT_SHIFT"]);
  k("RCTRL", "⌃", "Right Control", "Modifiers", 7, 0xe4, "ControlRight", ["RCTL", "RIGHT_CONTROL"]);
  k("RALT", "⌥", "Right Option", "Modifiers", 7, 0xe6, "AltRight", ["RIGHT_ALT", "ROPT"]);
  k("RGUI", "⌘", "Right Command", "Modifiers", 7, 0xe7, "MetaRight", ["RCMD", "RWIN", "RMETA", "RIGHT_GUI", "RIGHT_WIN", "RIGHT_COMMAND"]);
  k("CAPS", "⇪", "Caps Lock", "Modifiers", 7, 0x39, "CapsLock", ["CAPSLOCK", "CLCK"]);

  k("ESC", "Esc", "Escape", "Editing", 7, 0x29, "Escape", ["ESCAPE"]);
  k("TAB", "⇥", "Tab", "Editing", 7, 0x2b, "Tab");
  k("RET", "⏎", "Return", "Editing", 7, 0x28, "Enter", ["ENTER", "RETURN"]);
  k("SPACE", "␣", "Space", "Editing", 7, 0x2c, "Space", ["SPC"]);
  k("BSPC", "⌫", "Backspace", "Editing", 7, 0x2a, "Backspace", ["BACKSPACE"]);
  k("DEL", "⌦", "Delete", "Editing", 7, 0x4c, "Delete", ["DELETE"]);
  k("INS", "Ins", "Insert", "Editing", 7, 0x49, "Insert", ["INSERT"]);
  k("PSCRN", "PrtSc", "Print Screen", "Editing", 7, 0x46, "PrintScreen", ["PRINTSCREEN"]);
  k("SLCK", "ScrLk", "Scroll Lock", "Editing", 7, 0x47, "ScrollLock", ["SCROLLLOCK"]);
  k("PAUSE_BREAK", "Pause", "Pause", "Editing", 7, 0x48, "Pause", ["PAUSE"]);
  k("K_APP", "Menu", "Application", "Editing", 7, 0x65, "ContextMenu", ["K_APPLICATION", "K_CONTEXT_MENU"]);

  k("LEFT", "←", "Left", "Navigation", 7, 0x50, "ArrowLeft", ["LEFT_ARROW"]);
  k("DOWN", "↓", "Down", "Navigation", 7, 0x51, "ArrowDown", ["DOWN_ARROW"]);
  k("UP", "↑", "Up", "Navigation", 7, 0x52, "ArrowUp", ["UP_ARROW"]);
  k("RIGHT", "→", "Right", "Navigation", 7, 0x4f, "ArrowRight", ["RIGHT_ARROW"]);
  k("HOME", "Home", "Home", "Navigation", 7, 0x4a, "Home");
  k("END", "End", "End", "Navigation", 7, 0x4d, "End");
  k("PG_UP", "PgUp", "Page Up", "Navigation", 7, 0x4b, "PageUp", ["PAGE_UP"]);
  k("PG_DN", "PgDn", "Page Down", "Navigation", 7, 0x4e, "PageDown", ["PAGE_DOWN"]);

  for (let n = 1; n <= 24; n++) k(`F${n}`, `F${n}`, `F${n}`, "Function", 7, n <= 12 ? 0x3a + n - 1 : 0x68 + n - 13, `F${n}`);
  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => k(`KP_N${n}`, `${n}`, `Keypad ${n}`, "Keypad", 7, 0x59 + n - 1, `Numpad${n}`, [`KP_NUMBER_${n}`]));
  k("KP_N0", "0", "Keypad 0", "Keypad", 7, 0x62, "Numpad0", ["KP_NUMBER_0"]);
  k("KP_NUM", "Num", "Num Lock", "Keypad", 7, 0x53, "NumLock", ["KP_NUMLOCK", "KP_NLCK"]);
  k("KP_DIVIDE", "/", "Keypad Divide", "Keypad", 7, 0x54, "NumpadDivide", ["KP_SLASH"]);
  k("KP_MULTIPLY", "*", "Keypad Multiply", "Keypad", 7, 0x55, "NumpadMultiply", ["KP_ASTERISK"]);
  k("KP_MINUS", "−", "Keypad Minus", "Keypad", 7, 0x56, "NumpadSubtract", ["KP_SUBTRACT"]);
  k("KP_PLUS", "+", "Keypad Plus", "Keypad", 7, 0x57, "NumpadAdd");
  k("KP_ENTER", "⌤", "Keypad Enter", "Keypad", 7, 0x58, "NumpadEnter");
  k("KP_DOT", ".", "Keypad Dot", "Keypad", 7, 0x63, "NumpadDecimal");
  k("KP_EQUAL", "=", "Keypad Equal", "Keypad", 7, 0x67, "NumpadEqual");

  k("C_VOL_UP", "🔊", "Volume Up", "Media", 0x0c, 0xe9, "AudioVolumeUp", ["C_VOLUME_UP"]);
  k("C_VOL_DN", "🔉", "Volume Down", "Media", 0x0c, 0xea, "AudioVolumeDown", ["C_VOLUME_DOWN"]);
  k("C_MUTE", "🔇", "Mute", "Media", 0x0c, 0xe2, "AudioVolumeMute");
  k("C_PP", "⏯", "Play / Pause", "Media", 0x0c, 0xcd, "MediaPlayPause", ["C_PLAY_PAUSE"]);
  k("C_NEXT", "⏭", "Next Track", "Media", 0x0c, 0xb5, "MediaTrackNext");
  k("C_PREV", "⏮", "Previous Track", "Media", 0x0c, 0xb6, "MediaTrackPrevious", ["C_PREVIOUS"]);
  k("C_STOP", "⏹", "Stop", "Media", 0x0c, 0xb7, "MediaStop");
  k("C_BRI_UP", "☀+", "Brightness Up", "Media", 0x0c, 0x6f, null, ["C_BRIGHTNESS_INC"]);
  k("C_BRI_DN", "☀−", "Brightness Down", "Media", 0x0c, 0x70, null, ["C_BRIGHTNESS_DEC"]);
  k("C_EJECT", "⏏", "Eject", "Media", 0x0c, 0xb8, null);
  k("C_AL_CALC", "Calc", "Calculator", "Media", 0x0c, 0x192, null, ["C_AL_CALCULATOR"]);

  const BY_NAME = new Map();
  for (const def of KEYS) {
    BY_NAME.set(def.code, def);
    for (const a of def.aliases) BY_NAME.set(a, def);
  }
  const REVERSE = new Map();
  for (const def of KEYS) if (def.page) REVERSE.set((def.page << 16) | def.usage, def.code);
  const REVERSE_SHIFT = new Map(Object.entries(SHIFT_BASE).map(([s, b]) => [b, s]));
  const BY_BROWSER = new Map(KEYS.filter((d) => d.browser).map((d) => [d.browser, d.code]));

  // Modifier wrappers: LC(), LS(), …
  const MODS = [
    { fn: "LC", bit: 0x01, symbol: "⌃", name: "Control", order: 0, key: "LCTRL" },
    { fn: "LS", bit: 0x02, symbol: "⇧", name: "Shift", order: 2, key: "LSHFT" },
    { fn: "LA", bit: 0x04, symbol: "⌥", name: "Option", order: 1, key: "LALT" },
    { fn: "LG", bit: 0x08, symbol: "⌘", name: "Command", order: 3, key: "LGUI" },
    { fn: "RC", bit: 0x10, symbol: "⌃", name: "Right Control", order: 0, key: "RCTRL" },
    { fn: "RS", bit: 0x20, symbol: "⇧", name: "Right Shift", order: 2, key: "RSHFT" },
    { fn: "RA", bit: 0x40, symbol: "⌥", name: "Right Option", order: 1, key: "RALT" },
    { fn: "RG", bit: 0x80, symbol: "⌘", name: "Right Command", order: 3, key: "RGUI" },
  ];
  const MOD_BY_FN = new Map(MODS.map((x) => [x.fn, x]));

  /** "LS(LG(S))" -> { key: "S", mods: ["LS","LG"] } (outermost first). */
  function parseExpr(text) {
    let s = String(text).replace(/\s/g, "");
    const mods = [];
    for (;;) {
      const open = s.indexOf("(");
      if (open < 0 || !s.endsWith(")") || !MOD_BY_FN.has(s.slice(0, open))) break;
      mods.push(s.slice(0, open));
      s = s.slice(open + 1, -1);
    }
    return { key: s, mods };
  }

  function formatExpr(key, mods) {
    return mods.reduceRight((inner, m) => `${m}(${inner})`, key);
  }

  function lookup(name) { return BY_NAME.get(name) || null; }

  /** "LG(LS(A))" -> 0x0A070004, or null. */
  function encode(text) {
    const { key: raw, mods } = parseExpr(text);
    let key = lookup(raw)?.code || raw;
    let bits = 0;
    if (SHIFT_BASE[key]) { key = SHIFT_BASE[key]; bits |= 0x02; }
    const def = lookup(key);
    if (!def || !def.page) return null;
    for (const m of mods) bits |= MOD_BY_FN.get(m).bit;
    return ((bits << 24) | (def.page << 16) | def.usage) >>> 0;
  }

  /** 0x0A070004 -> "LG(LS(A))", preferring named shifted symbols. */
  function decode(value) {
    value >>>= 0;
    let bits = value >>> 24;
    const usage = value & 0xffffff;
    const page = (usage >>> 16) & 0xff;
    const normalized = page === 0 ? (7 << 16) | usage : usage;
    let name = REVERSE.get(normalized);
    if (!name) return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
    if (bits & 0x02 && REVERSE_SHIFT.has(name)) { name = REVERSE_SHIFT.get(name); bits &= ~0x02; }
    return formatExpr(name, MODS.filter((m) => bits & m.bit).map((m) => m.fn));
  }

  /** Keycap legend for an expression, e.g. "⌘Space". */
  function label(text) {
    const { key, mods } = parseExpr(text);
    const def = lookup(key);
    const base = def ? def.label : key;
    const modText = mods.map((m) => MOD_BY_FN.get(m)).filter(Boolean).sort((a, b) => a.order - b.order).map((m) => m.symbol).join("");
    return modText + base;
  }

  function longName(text) {
    const { key, mods } = parseExpr(text);
    const def = lookup(key);
    const names = mods.map((m) => MOD_BY_FN.get(m)?.name).filter(Boolean);
    return [...names, def ? def.name : key].join(" + ");
  }

  const MAC_SHORTCUTS = [
    ["LC(UP)", "Mission Control", "Mission"], ["LC(DOWN)", "App Windows", "App Wins"],
    ["LC(LEFT)", "Previous Space", "Space ←"], ["LC(RIGHT)", "Next Space", "Space →"],
    ["LG(SPACE)", "Spotlight", "Spotlight"], ["LS(LG(N5))", "Screenshot & Recording", "Capture"],
    ["LS(LG(N4))", "Screenshot Area", "Snip"], ["LC(LG(Q))", "Lock Screen", "Lock"],
    ["LC(LG(SPACE))", "Emoji & Symbols", "Emoji"], ["LA(LG(ESC))", "Force Quit", "Force Quit"],
    ["LC(SPACE)", "Switch Input Language", "Language"], ["LG(TAB)", "Last App", "Last App"],
  ].map(([expr, name, short]) => ({ expr, name, short }));

  function macShortcut(text) {
    const v = encode(text);
    if (v == null) return null;
    return MAC_SHORTCUTS.find((s) => encode(s.expr) === v) || null;
  }

  function isModifierKey(text) {
    const { key, mods } = parseExpr(text);
    return mods.length === 0 && lookup(key)?.category === "Modifiers";
  }

  /** KeyboardEvent -> expression including held modifiers (e.g. ⌘⇧4 -> "LG(LS(N4))"). */
  function exprForEvent(e) {
    const key = BY_BROWSER.get(e.code);
    if (!key) return null;
    if (lookup(key).category === "Modifiers") return key;
    const mods = [];
    if (e.ctrlKey) mods.push("LC");
    if (e.altKey) mods.push("LA");
    if (e.shiftKey) mods.push("LS");
    if (e.metaKey) mods.push("LG");
    return formatExpr(key, mods);
  }

  const api = {
    KEYS, CATEGORIES, MODS, MAC_SHORTCUTS, lookup, parseExpr, formatExpr, encode, decode, label, longName,
    macShortcut, isModifierKey, exprForEvent, codeForBrowser: (c) => BY_BROWSER.get(c) || null,
  };
  root.ZmkHID = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
