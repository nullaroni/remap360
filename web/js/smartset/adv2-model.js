// Kinesis Advantage2 described for the shared SmartSet editor.
(function (root) {
  "use strict";

  const T = root.A2Tokens;
  const { LayoutFile, familyForFilename } = root.A2Layout;

  // Advantage2 locations already carry their layer ("kp-a" vs "a"), so the layer argument is unused.
  class Adv2File {
    constructor(text) { this.f = text instanceof LayoutFile ? text : new LayoutFile(text); }
    toString() { return this.f.toString(); }
    clone() { return new Adv2File(this.f.clone()); }
    binding(_layer, loc) { return this.f.binding(loc); }
    actionFor(_layer, loc) { return this.f.actionFor(loc); }
    macrosFor(_layer, loc) { return this.f.macrosFor(loc); }
    singleMacro(_layer, loc) { return this.f.singleMacro(loc); }
    setAction(_layer, loc, action) { this.f.setAction(loc, action); }
    setTapHold(_layer, loc, tap, hold, delay) { this.f.setTapHold(loc, tap, hold, delay); }
    setMacro(_layer, trigger, body) { this.f.setMacro(trigger, body); }
    reset(_layer, loc) { this.f.reset(loc); }
    swap(_layer, a, b) { this.f.swap(a, b); }
    problems() { return this.f.problems(); }
    stats() { return this.f.stats(); }
  }

  const IGNORED = new Set(["state.txt", "version.txt", "do_not_edit.txt"]);

  root.Adv2Model = {
    id: "adv2",
    name: "Advantage2",
    shortName: "Advantage2",
    layers: [{ id: "top", name: "Top layer" }, { id: "keypad", name: "Keypad layer" }],
    families: ["qwerty", "dvorak"],
    familyForFilename,
    locations: (layer, family) => T.locations(family || "qwerty", layer),
    keys: root.Board.flattenGroups(T.GEOMETRY, T.THUMB_GROUPS),
    size: { w: 17.5, h: 9.6 },
    isFixed: (loc) => T.NOT_PROGRAMMABLE.has(loc),
    defaultAction: (loc) => T.defaultAction(loc),
    locationName: (loc, _layer, mac) => T.describe(T.defaultAction(loc), mac).name,
    locationLabel: (loc, mac) => T.describe(T.defaultAction(loc), mac).label,
    describe: T.describe,
    ACTIONS: T.ACTIONS,
    CATEGORIES: T.CATEGORIES,
    isMacroToken: T.isMacroToken,
    tokenForCode: T.tokenForCode,
    textToMacro: T.textToMacro,
    macroToText: T.macroToText,
    isModifierLocation: (loc) => T.MODIFIER_LOCATIONS.has(loc),
    modifierLocations: (layer, family) =>
      T.locations(family || "qwerty", layer).filter((l) => T.MODIFIER_LOCATIONS.has(l) && !["kp-lwin", "kp-ralt"].includes(l)),
    newFile: (text) => new Adv2File(text),
    nullToken: "null",
    drive: {
      label: "ADVANTAGE2",
      folder: "active",
      isLayoutFile: (name) => /\.txt$/i.test(name) && !IGNORED.has(name.toLowerCase()),
      rank: (name) => (name.toLowerCase() === "qwerty.txt" ? 0 : name.toLowerCase() === "dvorak.txt" ? 1 : 2),
      defaultFileName: "qwerty.txt",
    },
    presets: [
      {
        id: "mac", label: "Mac thumb keys (⌘ ⌥ ⌃ ⌘)",
        apply: (f) => {
          for (const [loc, to] of Object.entries({ lctrl: "lwin", rwin: "rctrl", rctrl: "rwin" })) {
            f.setAction("top", loc, to);
            f.setAction("keypad", `kp-${loc}`, to);
          }
        },
      },
      { id: "caps-ctrl", label: "Caps Lock → Ctrl", apply: (f) => f.setAction("top", "caps", "lctrl") },
      { id: "caps-esc", label: "Caps Lock: tap Esc, hold Ctrl", apply: (f) => f.setTapHold("top", "caps", "escape", "lctrl", 250) },
      { id: "no-caps", label: "Disable Caps Lock", apply: (f) => f.setAction("top", "caps", "null") },
    ],
    macroHelp: "Extra tokens: <code>{d125}</code> <code>{d500}</code> delays, <code>{speed1}</code>–<code>{speed9}</code>, <code>{-lshift}</code>/<code>{+lshift}</code> to hold/release.",
    helpSteps: [
      "Turn on Power User Mode: hold <kbd>progm</kbd> + <kbd>Shift</kbd> and tap <kbd>Esc</kbd>. The LEDs flash four times.",
      "Open the v-Drive: hold <kbd>progm</kbd> and tap <kbd>F1</kbd>. A drive called <b>ADVANTAGE2</b> appears after a few seconds.",
      "Click <b>Open v-Drive…</b> and choose the drive (or its <b>active</b> folder). Allow editing when the browser asks.",
      "Change keys, then click <b>Save</b>.",
      "<b>Eject</b> the drive, then press <kbd>progm</kbd> + <kbd>F1</kbd> to close it. Changes take effect when the v-Drive closes. You can also reload the layout with <kbd>progm</kbd> + <kbd>F3</kbd> (QWERTY) or <kbd>F4</kbd> (Dvorak).",
      "<b>Older keyboards with a 2&nbsp;MB v-Drive:</b> Kinesis recommends pasting new contents into the existing file instead of replacing it. Use <b>Copy</b> and paste into the open file to be safe.",
    ],
    layerNote: "",
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
