// A pretend Advantage360 Pro that answers ZMK Studio requests, for the demo mode and tests.
(function (root) {
  "use strict";

  const S = root.ZmkStudio || require("./studio.js");
  const HID = root.ZmkHID || require("./hid.js");
  const { ProtoWriter, ProtoMessage, frame, FrameDecoder, StudioConnection } = S;

  // Kinesis' stock Adv360 Pro keymap (Adv360-Pro-ZMK, MIT).
  const STOCK = [
    ["Base", `
      &kp EQUAL &kp N1 &kp N2 &kp N3 &kp N4 &kp N5 &tog 1   &mo 3 &kp N6 &kp N7 &kp N8 &kp N9 &kp N0 &kp MINUS
      &kp TAB &kp Q &kp W &kp E &kp R &kp T &none   &none &kp Y &kp U &kp I &kp O &kp P &kp BSLH
      &kp ESC &kp A &kp S &kp D &kp F &kp G &none &kp LCTRL &kp LALT &kp LGUI &kp RCTRL &none &kp H &kp J &kp K &kp L &kp SEMI &kp SQT
      &kp LSHFT &kp Z &kp X &kp C &kp V &kp B &kp HOME &kp PG_UP &kp N &kp M &kp COMMA &kp DOT &kp FSLH &kp RSHFT
      &mo 2 &kp GRAVE &kp CAPS &kp LEFT &kp RIGHT &kp BSPC &kp DEL &kp END &kp PG_DN &kp ENTER &kp SPACE &kp UP &kp DOWN &kp LBKT &kp RBKT &mo 2`],
    ["Kp", `
      &kp EQUAL &kp N1 &kp N2 &kp N3 &kp N4 &kp N5 &trans   &mo 3 &kp N6 &kp KP_NUM &kp KP_EQUAL &kp KP_DIVIDE &kp KP_MULTIPLY &kp MINUS
      &kp TAB &kp Q &kp W &kp E &kp R &kp T &none   &none &kp Y &kp KP_N7 &kp KP_N8 &kp KP_N9 &kp KP_MINUS &kp BSLH
      &kp ESC &kp A &kp S &kp D &kp F &kp G &none &kp LCTRL &kp LALT &kp LGUI &kp RCTRL &none &kp H &kp KP_N4 &kp KP_N5 &kp KP_N6 &kp KP_PLUS &kp SQT
      &kp LSHFT &kp Z &kp X &kp C &kp V &kp B &kp HOME &kp PG_UP &kp N &kp KP_N1 &kp KP_N2 &kp KP_N3 &kp KP_ENTER &kp RSHFT
      &mo 2 &kp GRAVE &kp CAPS &kp LEFT &kp RIGHT &kp BSPC &kp DEL &kp END &kp PG_DN &kp ENTER &kp KP_N0 &kp UP &kp DOWN &kp KP_DOT &kp RBKT &mo 2`],
    ["Fn", `
      &kp F1 &kp F2 &kp F3 &kp F4 &kp F5 &kp F6 &tog 1   &mo 3 &kp F7 &kp F8 &kp F9 &kp F10 &kp F11 &kp F12
      &trans &trans &trans &trans &trans &trans &none   &none &trans &trans &trans &trans &trans &trans
      &trans &trans &trans &trans &trans &trans &none &trans &trans &trans &trans &none &trans &trans &trans &trans &trans &trans
      &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans
      &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans &trans`],
    ["Mod", `
      &none &bt BT_SEL 0 &bt BT_SEL 1 &bt BT_SEL 2 &bt BT_SEL 3 &bt BT_SEL 4 &none   &trans &none &none &none &none &none &none
      &none &none &none &none &none &none &bootloader   &bootloader &none &none &none &none &none &none
      &studio_unlock &none &none &none &none &none &none &none &none &bt BT_CLR &none &stp STP_BAT &none &none &none &none &none &none
      &none &none &none &none &macro_ver &none &none &none &none &none &none &none &none &none
      &none &none &none &none &none &none &none &none &none &bl BL_TOG &rgb_ug RGB_TOG &bl BL_INC &bl BL_DEC &none &none &none`],
  ];

  const HID_PARAM = { name: "Key", kind: "hid" };
  const LAYER_PARAM = { name: "Layer", kind: "layer" };
  // [id, display name, label used in STOCK, param1 values, param2 values]
  const BEHAVIORS = [
    [1, "Key Press", "kp", [HID_PARAM], []],
    [2, "Mod-Tap", "mt", [HID_PARAM], [HID_PARAM]],
    [3, "Layer-Tap", "lt", [LAYER_PARAM], [HID_PARAM]],
    [4, "Momentary Layer", "mo", [LAYER_PARAM], []],
    [5, "Toggle Layer", "tog", [LAYER_PARAM], []],
    [6, "To Layer", "to", [LAYER_PARAM], []],
    [7, "Transparent", "trans", [], []],
    [8, "None", "none", [], []],
    [9, "Bluetooth", "bt", [{ name: "Command", kind: "range", min: 0, max: 5 }], [{ name: "Profile", kind: "range", min: 0, max: 4 }]],
    [10, "Studio Unlock", "studio_unlock", [], []],
    [11, "Bootloader", "bootloader", [], []],
    [12, "Caps Word", "caps_word", [], []],
    [13, "Mouse Button Press", "mkp", [{ name: "Button", kind: "range", min: 0, max: 31 }], []],
    [14, "Backlight", "bl", [{ name: "Command", kind: "range", min: 0, max: 6 }], []],
    [15, "Underglow", "rgb_ug", [{ name: "Command", kind: "range", min: 0, max: 15 }], []],
    [16, "Battery Level", "stp", [], []],
    [17, "Version", "macro_ver", [], []],
    [18, "Sticky Key", "sk", [HID_PARAM], []],
  ];
  const ID_BY_LABEL = Object.fromEntries(BEHAVIORS.map((b) => [b[2], b[0]]));

  function parseBindings(text) {
    const out = [];
    for (const tok of text.trim().split(/\s+/)) {
      if (tok.startsWith("&")) out.push({ behavior: tok.slice(1), params: [] });
      else out[out.length - 1].params.push(tok);
    }
    return out;
  }

  function rawBinding(b) {
    const id = ID_BY_LABEL[b.behavior];
    const p = b.params;
    const lists = {
      bt: ["BT_CLR", "BT_NXT", "BT_PRV", "BT_SEL", "BT_CLR_ALL", "BT_DISC"],
      bl: ["BL_ON", "BL_OFF", "BL_TOG", "BL_INC", "BL_DEC", "BL_CYCLE", "BL_SET"],
      rgb_ug: ["RGB_TOG"],
    };
    switch (b.behavior) {
      case "kp": case "sk": return { behaviorID: id, param1: HID.encode(p[0]), param2: 0 };
      case "mo": case "tog": case "to": return { behaviorID: id, param1: +p[0], param2: 0 };
      case "bt": return { behaviorID: id, param1: lists.bt.indexOf(p[0]), param2: p[1] ? +p[1] : 0 };
      case "bl": case "rgb_ug": return { behaviorID: id, param1: lists[b.behavior].indexOf(p[0]), param2: 0 };
      default: return { behaviorID: id, param1: 0, param2: 0 };
    }
  }

  function stockLayers() {
    return STOCK.map(([name, text], i) => ({ id: i, name, bindings: parseBindings(text).map(rawBinding) }));
  }

  class SimulatedKeyboard {
    constructor({ locked = true } = {}) {
      this.locked = locked;
      this.saved = stockLayers();
      this.layers = structuredClone(this.saved);
      this.decoder = new FrameDecoder();
      this.toHost = null;
      this.nextLayerID = 8;
    }

    get unsaved() { return JSON.stringify(this.layers) !== JSON.stringify(this.saved); }

    send(build) {
      const w = new ProtoWriter();
      build(w);
      const bytes = frame(w.data());
      setTimeout(() => this.toHost && this.toHost(bytes), 5);
    }

    respond(id, build) { this.send((w) => w.message(1, (rr) => { rr.uint(1, id); build(rr); })); }

    notifyUnsaved() { this.send((w) => w.message(2, (n) => n.message(5, (k) => k.bool(1, this.unsaved)))); }

    /** Pretend the user pressed the unlock combo on the keyboard. */
    unlock() {
      this.locked = false;
      this.send((w) => w.message(2, (n) => n.message(2, (c) => c.uint(1, 1))));
    }

    writeLayer(w, field, l) {
      w.message(field, (lm) => {
        lm.uint(1, l.id);
        lm.string(2, l.name);
        for (const b of l.bindings) lm.message(3, (bm) => { bm.sint(1, b.behaviorID); bm.uint(2, b.param1); bm.uint(3, b.param2); });
      });
    }

    receive(bytes) {
      for (const f of this.decoder.feed(bytes)) this.handle(new ProtoMessage(f));
    }

    handle(req) {
      const id = req.uint(1);
      const core = req.message(3), beh = req.message(4), km = req.message(5);
      const meta = (code) => this.respond(id, (rr) => rr.message(2, (m) => m.uint(2, code)));
      if (core) {
        if (core.has(1)) return this.respond(id, (rr) => rr.message(3, (c) => c.message(1, (i) => i.string(1, "Adv360 Pro (demo)"))));
        if (core.has(2)) return this.respond(id, (rr) => rr.message(3, (c) => c.uint(2, this.locked ? 0 : 1)));
        if (core.has(3)) { this.locked = true; return this.respond(id, (rr) => rr.message(3, (c) => c.uint(2, 0))); }
      }
      if (beh) {
        if (beh.has(1)) return this.respond(id, (rr) => rr.message(4, (b) => b.message(1, (l) => BEHAVIORS.forEach((x) => l.uint(1, x[0])))));
        const d = beh.message(2);
        if (d) {
          const b = BEHAVIORS.find((x) => x[0] === d.uint(1));
          return this.respond(id, (rr) => rr.message(4, (bm) => bm.message(2, (dm) => {
            dm.uint(1, b[0]);
            dm.string(2, b[1]);
            dm.message(3, (set) => {
              const value = (field, v) => set.message(field, (pv) => {
                pv.string(1, v.name);
                if (v.kind === "hid") pv.message(5, (h) => { h.uint(1, 0xff); h.uint(2, 0xfff); });
                else if (v.kind === "layer") pv.bool(6, true);
                else pv.message(4, (r) => { r.int(1, v.min); r.int(2, v.max); });
              });
              b[3].forEach((v) => value(1, v));
              b[4].forEach((v) => value(2, v));
            });
          })));
        }
      }
      if (this.locked) return meta(1);
      if (!km) return meta(2);
      const keymap = (rr, field) => rr.message(5, (k) => k.message(field, (m) => {
        for (const l of this.layers) this.writeLayer(m, 1, l);
        m.uint(2, 8 - this.layers.length);
        m.uint(3, 20);
      }));
      if (km.has(1)) return this.respond(id, (rr) => keymap(rr, 1));
      const set = km.message(2);
      if (set) {
        const layer = this.layers.find((l) => l.id === set.uint(1));
        const pos = set.int(2);
        const b = set.message(3);
        if (!layer || pos < 0 || pos >= layer.bindings.length) return this.respond(id, (rr) => rr.message(5, (k) => k.uint(2, 1)));
        if (!BEHAVIORS.some((x) => x[0] === b.sint(1))) return this.respond(id, (rr) => rr.message(5, (k) => k.uint(2, 2)));
        layer.bindings[pos] = { behaviorID: b.sint(1), param1: b.uint(2), param2: b.uint(3) };
        this.respond(id, (rr) => rr.message(5, () => {}));
        return this.notifyUnsaved();
      }
      if (km.has(3)) return this.respond(id, (rr) => rr.message(5, (k) => k.bool(3, this.unsaved)));
      if (km.has(4)) {
        this.saved = structuredClone(this.layers);
        this.respond(id, (rr) => rr.message(5, (k) => k.message(4, (s) => s.bool(1, true))));
        return this.notifyUnsaved();
      }
      if (km.has(5)) {
        this.layers = structuredClone(this.saved);
        this.respond(id, (rr) => rr.message(5, (k) => k.bool(5, true)));
        return this.notifyUnsaved();
      }
      if (km.has(9)) {
        if (this.layers.length >= 8) return this.respond(id, (rr) => rr.message(5, (k) => k.message(9, (a) => a.uint(2, 2))));
        const trans = { behaviorID: ID_BY_LABEL.trans, param1: 0, param2: 0 };
        const layer = { id: this.nextLayerID++, name: "", bindings: Array.from({ length: 76 }, () => ({ ...trans })) };
        this.layers.push(layer);
        this.respond(id, (rr) => rr.message(5, (k) => k.message(9, (a) => a.message(1, (ok) => {
          ok.uint(1, this.layers.length - 1);
          this.writeLayer(ok, 2, layer);
        }))));
        return this.notifyUnsaved();
      }
      const rm = km.message(10);
      if (rm || km.has(10)) {
        const index = rm ? rm.uint(1) : 0;
        this.layers.splice(index, 1);
        this.respond(id, (rr) => rr.message(5, (k) => k.message(10, (r) => r.message(1, () => {}))));
        return this.notifyUnsaved();
      }
      const name = km.message(12);
      if (name) {
        const layer = this.layers.find((l) => l.id === name.uint(1));
        if (layer) layer.name = name.string(2);
        this.respond(id, (rr) => rr.message(5, (k) => k.uint(12, layer ? 0 : 1)));
        return this.notifyUnsaved();
      }
      return meta(2);
    }

    /** A StudioConnection wired to this simulated keyboard. */
    connect() {
      const transport = {
        write: (bytes) => { setTimeout(() => this.receive(bytes), 3); return Promise.resolve(); },
        close: () => { conn.didClose(); return Promise.resolve(); },
      };
      const conn = new StudioConnection(transport);
      this.toHost = (bytes) => conn.receive(bytes);
      return conn;
    }
  }

  const api = { SimulatedKeyboard, STOCK, BEHAVIORS };
  root.ZmkSim = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
