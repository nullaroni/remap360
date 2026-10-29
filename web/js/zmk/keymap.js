// The keymap as it lives on a connected Advantage360 Pro, with translation between
// raw Studio bindings and readable ones ({ behavior: "kp", params: ["LG(SPACE)"] }).
// A port of Sources/Remap360Core/LiveKeymap.swift plus the legend logic in Binding.swift.
(function (root) {
  "use strict";

  const HID = root.ZmkHID || (typeof require !== "undefined" ? require("./hid.js") : null);

  const BUILTIN_LABELS = {
    "key press": "kp", "mod-tap": "mt", "layer-tap": "lt", "momentary layer": "mo",
    "toggle layer": "tog", "to layer": "to", "sticky layer": "sl", "sticky key": "sk",
    "transparent": "trans", "none": "none", "bluetooth": "bt", "output selection": "out",
    "underglow": "rgb_ug", "rgb underglow": "rgb_ug", "backlight": "bl",
    "mouse key press": "mkp", "mouse button press": "mkp", "mouse button": "mkp",
    "reset": "sys_reset", "bootloader": "bootloader", "studio unlock": "studio_unlock",
    "caps word": "caps_word", "key repeat": "key_repeat", "battery level": "stp",
    "grave/escape": "gresc", "key toggle": "kt", "external power": "ext_power",
  };
  const BUILTIN_VALUES = new Set(Object.values(BUILTIN_LABELS));

  const BT = ["BT_CLR", "BT_NXT", "BT_PRV", "BT_SEL", "BT_CLR_ALL", "BT_DISC"];
  const OUT = ["OUT_TOG", "OUT_USB", "OUT_BLE"];
  const RGB = ["RGB_TOG", "RGB_ON", "RGB_OFF", "RGB_HUI", "RGB_HUD", "RGB_SAI", "RGB_SAD", "RGB_BRI",
    "RGB_BRD", "RGB_SPI", "RGB_SPD", "RGB_EFF", "RGB_EFR", "RGB_EFS", "RGB_MEFS", "RGB_COLOR_HSB"];
  const BL = ["BL_ON", "BL_OFF", "BL_TOG", "BL_INC", "BL_DEC", "BL_CYCLE", "BL_SET"];
  const MOUSE = [["LCLK", 1], ["RCLK", 2], ["MCLK", 4], ["MB4", 8], ["MB5", 16]];

  const isHid = (v) => v.kind.type === "hidUsage";
  const meaningful = (vals) => vals.some((v) => v.kind.type !== "nil");

  function paramCount(b) {
    const p1 = b.metadata.some((s) => meaningful(s.param1));
    const p2 = b.metadata.some((s) => meaningful(s.param2));
    return p2 ? 2 : p1 ? 1 : 0;
  }

  class LiveKeymap {
    constructor(keymap, behaviors) {
      this.layers = keymap.layers;
      this.availableLayers = keymap.availableLayers;
      this.maxLayerNameLength = keymap.maxLayerNameLength;
      this.behaviors = new Map(behaviors.map((b) => [b.id, b]));
      this.labelByID = new Map();
      this.idByLabel = new Map();
      this.custom = new Map(); // label -> { holdTap, displayName, cells }

      const used = new Set();
      for (const b of [...behaviors].sort((x, y) => x.id - y.id)) {
        const key = b.displayName.toLowerCase().trim();
        let label = BUILTIN_LABELS[key];
        if (!label || used.has(label)) {
          let base = b.displayName.replace(/[^\p{L}\p{N}]/gu, "_").replace(/^_+|_+$/g, "") || `behavior_${b.id}`;
          let candidate = base, n = 2;
          while (used.has(candidate) || BUILTIN_VALUES.has(candidate)) candidate = `${base}_${n++}`;
          label = candidate;
          const set = b.metadata[0];
          const hidParams = set ? (set.param1.some(isHid) ? 1 : 0) + (set.param2.some(isHid) ? 1 : 0) : 0;
          const cells = paramCount(b);
          this.custom.set(label, { holdTap: cells === 2 && hidParams === 2, displayName: b.displayName, cells });
        }
        used.add(label);
        this.labelByID.set(b.id, label);
        this.idByLabel.set(label, b.id);
      }
    }

    has(label) { return this.idByLabel.has(label); }
    layerIndex(id) { return this.layers.findIndex((l) => l.id === id); }
    layerName(i) { return this.layers[i]?.name || `Layer ${i}`; }

    // Studio -> readable
    toBinding(b) {
      const label = this.labelByID.get(b.behaviorID);
      if (!label) return { behavior: `behavior_${b.behaviorID}`, params: [`${b.param1}`, `${b.param2}`] };
      const layer = (v) => { const i = this.layerIndex(v); return i >= 0 ? `${i}` : `${v}`; };
      const cmd = (list, v) => (v < list.length ? list[v] : `${v}`);
      switch (label) {
        case "kp": case "sk": return { behavior: label, params: [HID.decode(b.param1)] };
        case "mt": return { behavior: label, params: [HID.decode(b.param1), HID.decode(b.param2)] };
        case "lt": return { behavior: label, params: [layer(b.param1), HID.decode(b.param2)] };
        case "mo": case "tog": case "to": case "sl": return { behavior: label, params: [layer(b.param1)] };
        case "bt": {
          const c = cmd(BT, b.param1);
          return { behavior: label, params: c === "BT_SEL" || c === "BT_DISC" ? [c, `${b.param2}`] : [c] };
        }
        case "out": return { behavior: label, params: [cmd(OUT, b.param1)] };
        case "rgb_ug": return { behavior: label, params: [cmd(RGB, b.param1)] };
        case "bl": return { behavior: label, params: [cmd(BL, b.param1)] };
        case "stp": return { behavior: label, params: ["STP_BAT"] };
        case "mkp": return { behavior: label, params: [(MOUSE.find((x) => x[1] === b.param1) || [`${b.param1}`])[0]] };
        default: {
          const c = this.custom.get(label);
          if (c && c.holdTap) return { behavior: label, params: [HID.decode(b.param1), HID.decode(b.param2)] };
          const count = this.behaviors.has(b.behaviorID) ? paramCount(this.behaviors.get(b.behaviorID)) : 0;
          return { behavior: label, params: [`${b.param1}`, `${b.param2}`].slice(0, count) };
        }
      }
    }

    // Readable -> Studio
    toStudio(k) {
      const id = this.idByLabel.get(k.behavior);
      if (id == null) throw new Error(`The keyboard's firmware doesn't include “${k.behavior}”, so it can't be set live.`);
      const p = (i) => k.params[i];
      const bad = (v) => new Error(`“${v}” isn't something the keyboard understands.`);
      const hid = (i) => { const v = HID.encode(p(i) ?? ""); if (v == null) throw bad(p(i) ?? "?"); return v; };
      const layer = (i) => {
        const idx = parseInt(p(i), 10);
        if (!(idx >= 0 && idx < this.layers.length)) throw bad(p(i) ?? "?");
        return this.layers[idx].id;
      };
      const cmd = (list, i) => {
        if (p(i) == null) return 0;
        const n = list.indexOf(p(i));
        if (n >= 0) return n;
        if (/^\d+$/.test(p(i))) return +p(i);
        throw bad(p(i));
      };
      const num = (i) => {
        if (p(i) == null) return 0;
        if (!/^\d+$/.test(p(i))) throw bad(p(i));
        return +p(i);
      };
      const B = (p1 = 0, p2 = 0) => ({ behaviorID: id, param1: p1 >>> 0, param2: p2 >>> 0 });
      switch (k.behavior) {
        case "kp": case "sk": return B(hid(0));
        case "mt": return B(hid(0), hid(1));
        case "lt": return B(layer(0), hid(1));
        case "mo": case "tog": case "to": case "sl": return B(layer(0));
        case "bt": return B(cmd(BT, 0), num(1));
        case "out": return B(cmd(OUT, 0));
        case "rgb_ug": return B(cmd(RGB, 0));
        case "bl": return B(cmd(BL, 0));
        case "stp": return B();
        case "mkp": {
          const v = p(0) || "LCLK";
          const alias = { MB1: "LCLK", MB2: "RCLK", MB3: "MCLK" }[v] || v;
          const found = MOUSE.find((x) => x[0] === alias);
          if (found) return B(found[1]);
          if (/^\d+$/.test(v)) return B(+v);
          throw bad(v);
        }
        default: {
          const c = this.custom.get(k.behavior);
          if (c && c.holdTap) return B(hid(0), hid(1));
          return B(num(0), num(1));
        }
      }
    }

    customBehaviors() {
      return [...this.custom.entries()].map(([label, c]) => ({ label, ...c }));
    }
  }

  /** How a binding is drawn on a keycap: { label, hold, style }. */
  function legend(k, km) {
    const p0 = k.params[0], p1 = k.params[1];
    const layerName = (v) => km.layerName(parseInt(v, 10));
    switch (k.behavior) {
      case "kp": {
        const s = HID.macShortcut(p0 || "");
        if (s) return { label: s.short, style: "system" };
        const { key, mods } = HID.parseExpr(p0 || "");
        const def = HID.lookup(key);
        const shifted = !mods.length && def ? HID.KEYS.find((x) => x.shiftOf === def.code)?.label : null;
        return { label: HID.label(p0 || "?"), style: HID.isModifierKey(p0 || "") ? "modifier" : "key", shifted };
      }
      case "mt": return { label: HID.label(p1 || "?"), hold: HID.label(p0 || "?"), style: "holdtap" };
      case "lt": return { label: HID.label(p1 || "?"), hold: layerName(p0), style: "layer" };
      case "mo": return { label: layerName(p0), hold: "hold", style: "layer" };
      case "tog": return { label: layerName(p0), hold: "toggle", style: "layer" };
      case "to": return { label: layerName(p0), hold: "go to", style: "layer" };
      case "sl": return { label: layerName(p0), hold: "one-shot", style: "layer" };
      case "sk": return { label: HID.label(p0 || "?"), hold: "sticky", style: "modifier" };
      case "trans": return { label: "▽", style: "transparent" };
      case "none": return { label: "", style: "none" };
      case "bt": {
        const map = { BT_SEL: ["BT " + (p1 ?? ""), "select"], BT_CLR: ["BT", "clear"], BT_CLR_ALL: ["BT", "clear all"],
          BT_NXT: ["BT", "next"], BT_PRV: ["BT", "prev"], BT_DISC: ["BT " + (p1 ?? ""), "disconnect"] };
        const [label, hold] = map[p0] || ["BT", p0];
        return { label, hold, style: "system" };
      }
      case "out": return { label: { OUT_USB: "USB", OUT_BLE: "BLE", OUT_TOG: "Toggle" }[p0] || p0, hold: "output", style: "system" };
      case "rgb_ug": return { label: "RGB", hold: (p0 || "").replace("RGB_", "").toLowerCase(), style: "system" };
      case "bl": return { label: "Light", hold: (p0 || "").replace("BL_", "").toLowerCase(), style: "system" };
      case "mkp": return { label: { LCLK: "Left", RCLK: "Right", MCLK: "Middle", MB4: "Back", MB5: "Forward" }[p0] || p0, hold: "click", style: "system" };
      case "stp": return { label: "Battery", hold: "status", style: "system" };
      case "bootloader": return { label: "Boot", hold: "loader", style: "danger" };
      case "sys_reset": return { label: "Reset", style: "danger" };
      case "studio_unlock": return { label: "Studio", hold: "unlock", style: "system" };
      case "caps_word": return { label: "Caps", hold: "word", style: "modifier" };
      case "key_repeat": return { label: "Repeat", style: "system" };
      default: {
        const c = km.custom.get(k.behavior);
        if (c && c.holdTap && k.params.length === 2) return { label: HID.label(p1), hold: HID.label(p0), style: "holdtap" };
        if (c) return { label: c.displayName, style: "macro" };
        return { label: k.behavior, hold: k.params.join(" "), style: "unknown" };
      }
    }
  }

  /** Plain-English description for the inspector. */
  function describe(k, km) {
    const p0 = k.params[0], p1 = k.params[1];
    const layerName = (v) => `“${km.layerName(parseInt(v, 10))}”`;
    switch (k.behavior) {
      case "kp": { const s = HID.macShortcut(p0 || ""); return s ? s.name : HID.longName(p0 || "?"); }
      case "mt": return `${HID.longName(p1)} when tapped, ${HID.longName(p0)} when held`;
      case "lt": return `${HID.longName(p1)} when tapped, layer ${layerName(p0)} while held`;
      case "mo": return `Layer ${layerName(p0)} while held`;
      case "tog": return `Toggles layer ${layerName(p0)}`;
      case "to": return `Switches to layer ${layerName(p0)}`;
      case "sl": return `Layer ${layerName(p0)} for the next key`;
      case "sk": return `Sticky ${HID.longName(p0)}`;
      case "trans": return "Transparent: uses the key from the layer below";
      case "none": return "Does nothing";
      case "bt": return p0 === "BT_SEL" ? `Bluetooth profile ${+p1 + 1}` : `Bluetooth: ${(p0 || "").replace("BT_", "").toLowerCase()}`;
      case "mkp": return `Mouse ${legend(k, km).label.toLowerCase()} click`;
      case "caps_word": return "Caps Word: capitalizes until you finish the word";
      case "bootloader": return "Bootloader (for firmware updates)";
      default: { const l = legend(k, km); return [l.label, l.hold].filter(Boolean).join(" "); }
    }
  }

  const text = (k) => ["&" + k.behavior, ...k.params].join(" ");

  const api = { LiveKeymap, legend, describe, text, paramCount, BT, OUT, RGB, BL, MOUSE };
  root.ZmkKeymap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
