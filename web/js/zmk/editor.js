// Live editor for the Advantage360 Pro over ZMK Studio (Web Serial).
(function (root) {
  "use strict";

  const Board = root.Board;
  const HID = root.ZmkHID;
  const { LiveKeymap, legend, describe, text } = root.ZmkKeymap;
  const Geometry = root.Adv360Geometry;
  const ui = root.UI;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const state = {
    conn: null,
    sim: null,
    deviceName: "",
    status: "disconnected", // disconnected | locked | loading | ready
    km: null,
    unsaved: false,
    layer: 0,
    selected: null,
    tab: "key",
    category: "All",
    search: "",
    mods: new Set(),
    capturing: false,
    busy: false,
    pressed: new Set(),
    pollTimer: null,
  };

  const STYLE_KIND = {
    key: "default", modifier: "default", layer: "layer", holdtap: "taphold", transparent: "trans",
    none: "none", system: "system", danger: "danger", macro: "macro", unknown: "remapped",
  };

  const binding = (layer, pos) => state.km.toBinding(state.km.layers[layer].bindings[pos]);
  const posName = (pos) => {
    // Name keys after what they do on the stock base layer.
    const base = state.km ? binding(0, pos) : null;
    if (!base) return `Key ${pos + 1}`;
    const l = legend(base, state.km);
    return base.behavior === "kp" ? HID.longName(base.params[0]) : [l.label, l.hold].filter(Boolean).join(" ") || `Key ${pos + 1}`;
  };

  // ---------------------------------------------------------------------------
  // Connection lifecycle

  async function attach(conn, { name, sim = null } = {}) {
    await detach(true);
    state.conn = conn;
    state.sim = sim;
    state.deviceName = name || "Advantage360 Pro";
    state.status = "locked";
    conn.onNotification = (n) => {
      if (n.type === "lockStateChanged") {
        if (n.unlocked && state.status === "locked") load();
        if (!n.unlocked) { state.status = "locked"; render(); }
      }
      if (n.type === "unsavedChanged") { state.unsaved = n.unsaved; renderChrome(); }
    };
    conn.onClose = () => {
      if (state.conn !== conn) return;
      state.conn = null;
      state.status = "disconnected";
      state.km = null;
      clearInterval(state.pollTimer);
      render();
      ui.toast("The keyboard was disconnected.");
    };
    render();
    try {
      const lock = await conn.call({ type: "getLockState" });
      if (lock.unlocked) await load();
    } catch { /* stay locked */ }
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(async () => {
      if (state.status !== "locked" || !state.conn) return;
      try { if ((await state.conn.call({ type: "getLockState" }, 2000)).unlocked) load(); } catch { /* ignore */ }
    }, 1500);
  }

  async function detach(silent) {
    clearInterval(state.pollTimer);
    const conn = state.conn;
    state.conn = null;
    state.km = null;
    state.status = "disconnected";
    state.selected = null;
    if (conn) { conn.onClose = null; try { await conn.close(); } catch { /* ignore */ } }
    if (!silent) render();
  }

  async function load() {
    if (!state.conn) return;
    state.status = "loading";
    render();
    try {
      const { ids } = await state.conn.call({ type: "listBehaviors" });
      const behaviors = [];
      for (const id of ids) {
        const r = await state.conn.call({ type: "behaviorDetails", id });
        if (r.behavior) behaviors.push(r.behavior);
      }
      const { keymap } = await state.conn.call({ type: "getKeymap" });
      try { state.unsaved = (await state.conn.call({ type: "checkUnsaved" })).value; } catch { /* older firmware */ }
      state.km = new LiveKeymap(keymap, behaviors);
      state.layer = Math.min(state.layer, state.km.layers.length - 1);
      state.status = "ready";
    } catch (e) {
      state.status = "locked";
      if (e.code !== "locked") ui.toast(`Couldn't read the keymap: ${e.message}`);
    }
    render();
  }

  async function run(fn, okMessage) {
    if (state.busy) return;
    state.busy = true;
    try {
      await fn();
      if (okMessage) ui.toast(okMessage);
    } catch (e) {
      if (e.code === "locked") { state.status = "locked"; }
      ui.toast(e.message || String(e), 5000);
    } finally {
      state.busy = false;
      render();
    }
  }

  function setBinding(pos, k, layer = state.layer) {
    return run(async () => {
      const raw = state.km.toStudio(k);
      await state.conn.call({ type: "setBinding", layerID: state.km.layers[layer].id, position: pos, binding: raw });
      state.km.layers[layer].bindings[pos] = raw;
      state.unsaved = true;
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering

  function renderBoard() {
    const svg = $("#z-board");
    if (!state.km) { svg.textContent = ""; return; }
    const caps = Geometry.keys.map((_, pos) => {
      const k = binding(state.layer, pos);
      const l = legend(k, state.km);
      const classes = [];
      if (state.selected === pos) classes.push("selected");
      if (l.style === "modifier") classes.push("mod");
      if (k.behavior === "kp" && state.pressed.has(HID.parseExpr(k.params[0]).key)) classes.push("pressed");
      return {
        label: l.label,
        hold: l.hold,
        shifted: l.shifted,
        kind: STYLE_KIND[l.style] || "default",
        classes,
        title: `${posName(pos)} → ${describe(k, state.km)}\n${text(k)}`,
        ariaLabel: `${posName(pos)}: ${describe(k, state.km)}`,
      };
    });
    Board.render(svg, { keys: Geometry.keys, size: { w: 18, h: 7.85 }, caps });
  }

  function renderChrome() {
    const s = state.status;
    $("#z-status").textContent = {
      disconnected: "Not connected", locked: "Locked", loading: "Reading keymap…", ready: state.unsaved ? "Unsaved changes" : "Live",
    }[s];
    $("#z-status").className = `pill ${s === "ready" ? (state.unsaved ? "warn" : "ok") : s === "disconnected" ? "" : "warn"}`;
    $("#z-device").textContent = state.conn ? state.deviceName : "Advantage360 Pro";
    $("#z-connect").hidden = !!state.conn;
    $("#z-disconnect").hidden = !state.conn;
    $("#z-keep").disabled = !(s === "ready" && state.unsaved);
    $("#z-revert").disabled = !(s === "ready" && state.unsaved);

    $("#z-connect-panel").hidden = s !== "disconnected";
    $("#z-locked-panel").hidden = s !== "locked";
    $("#z-loading-panel").hidden = s !== "loading";
    $("#z-workspace").hidden = s !== "ready";
    $("#z-sim-unlock").hidden = !state.sim;
    $("#z-serial-missing").hidden = !!navigator.serial;

    const layers = $("#z-layers");
    layers.textContent = "";
    if (state.km) {
      state.km.layers.forEach((l, i) => {
        const b = document.createElement("button");
        b.textContent = l.name || `Layer ${i}`;
        b.className = i === state.layer ? "on" : "";
        b.onclick = () => { state.layer = i; state.selected = null; render(); };
        b.ondblclick = renameLayer;
        layers.appendChild(b);
      });
      $("#z-add-layer").disabled = !state.km.availableLayers;
      $("#z-remove-layer").disabled = state.km.layers.length <= 1;
    }
    ui.setTitle(state.unsaved ? "• Advantage360 Pro" : "Advantage360 Pro");
  }

  function renderInspector() {
    const has = state.selected != null && state.km;
    $("#z-inspector-empty").hidden = has;
    $("#z-inspector-key").hidden = !has;
    if (!has) return;
    const pos = state.selected;
    const k = binding(state.layer, pos);
    const l = legend(k, state.km);
    $("#z-key-title").textContent = `${posName(pos)} key`;
    $("#z-key-desc").textContent = `${describe(k, state.km)} · ${state.km.layerName(state.layer)}`;
    $("#z-key-cap").textContent = l.label || " ";
    $("#z-key-cap").className = `cap k-${STYLE_KIND[l.style] || "default"}`;
    $("#z-key-code").textContent = text(k);

    $$("[data-z-tab]").forEach((b) => b.classList.toggle("on", b.dataset.zTab === state.tab));
    $$("[data-z-panel]").forEach((p) => (p.hidden = p.dataset.zPanel !== state.tab));
    $("#z-capture").textContent = state.capturing ? "Press keys… (click to cancel)" : "Press a key…";
    $("#z-capture").classList.toggle("armed", state.capturing);
    $("#z-trans").disabled = !state.km.has("trans");
    $("#z-none").disabled = !state.km.has("none");

    if (state.tab === "key") renderKeyPicker(k);
    if (state.tab === "layer") renderLayerPanel(k);
    if (state.tab === "holdtap") renderHoldTap(k);
    if (state.tab === "more") renderMore(k);
  }

  function renderKeyPicker(k) {
    const current = k.behavior === "kp" ? k.params[0] : null;
    const curMods = current ? HID.parseExpr(current).mods : [];
    if (!state.modsTouched) state.mods = new Set(curMods);
    $$("#z-mods button").forEach((b) => b.classList.toggle("on", state.mods.has(b.dataset.mod)));

    const cats = $("#z-picker-cats");
    cats.textContent = "";
    for (const c of ["All", ...HID.CATEGORIES]) {
      const b = document.createElement("button");
      b.textContent = c;
      b.className = c === state.category ? "on" : "";
      b.onclick = () => { state.category = c; renderInspector(); };
      cats.appendChild(b);
    }
    const q = state.search.trim().toLowerCase();
    const grid = $("#z-picker");
    grid.textContent = "";
    const match = (...s) => !q || s.some((x) => x && x.toLowerCase().includes(q));
    const curKey = current ? HID.parseExpr(current).key : null;
    if (state.category === "All" || state.category === "Mac Shortcuts") {
      for (const s of HID.MAC_SHORTCUTS) {
        if (!match(s.name, s.short, s.expr)) continue;
        grid.appendChild(ui.pickButton(s.short, s.name, `${s.name} (${s.expr})`, current && HID.encode(current) === HID.encode(s.expr),
          () => setBinding(state.selected, { behavior: "kp", params: [s.expr] })));
      }
    }
    for (const def of HID.KEYS) {
      if (state.category !== "All" && def.category !== state.category) continue;
      if (!match(def.code, def.label, def.name, ...def.aliases)) continue;
      grid.appendChild(ui.pickButton(def.label, def.name === def.label ? "" : def.name, `${def.name} [${def.code}]`,
        def.code === curKey && curMods.join() === [...state.mods].join(), () => {
          const expr = HID.formatExpr(def.code, [...state.mods]);
          setBinding(state.selected, { behavior: "kp", params: [expr] });
        }));
    }
    if (!grid.children.length) grid.innerHTML = `<p class="muted">No matching keys.</p>`;
  }

  function fillKeySelect(select, value, filter = () => true) {
    select.textContent = "";
    for (const cat of HID.CATEGORIES.filter((c) => c !== "Mac Shortcuts")) {
      const og = document.createElement("optgroup");
      og.label = cat;
      for (const def of HID.KEYS.filter((d) => d.category === cat && filter(d))) {
        const o = document.createElement("option");
        o.value = def.code;
        o.textContent = `${def.label}  ${def.name}`;
        og.appendChild(o);
      }
      if (og.children.length) select.appendChild(og);
    }
    if (value) {
      if (![...select.options].some((o) => o.value === value)) {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = HID.longName(value);
        select.prepend(o);
      }
      select.value = value;
    }
  }

  function fillLayerSelect(select, value) {
    select.textContent = "";
    state.km.layers.forEach((l, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = l.name || `Layer ${i}`;
      select.appendChild(o);
    });
    select.value = value ?? (state.layer === 0 ? 1 : 0);
  }

  function renderLayerPanel(k) {
    const kinds = [["mo", "Hold for layer"], ["tog", "Toggle layer"], ["to", "Switch to layer"], ["sl", "One-shot layer"], ["lt", "Tap key, hold for layer"]]
      .filter(([b]) => state.km.has(b));
    const sel = $("#z-layer-kind");
    const prev = ["mo", "tog", "to", "sl", "lt"].includes(k.behavior) ? k.behavior : sel.value || "mo";
    sel.textContent = "";
    for (const [b, label] of kinds) {
      const o = document.createElement("option");
      o.value = b;
      o.textContent = label;
      sel.appendChild(o);
    }
    sel.value = kinds.some(([b]) => b === prev) ? prev : kinds[0]?.[0];
    fillLayerSelect($("#z-layer-target"), ["mo", "tog", "to", "sl", "lt"].includes(k.behavior) ? k.params[0] : null);
    fillKeySelect($("#z-layer-tap"), k.behavior === "lt" ? k.params[1] : "SPACE");
    $("#z-layer-tap-row").hidden = sel.value !== "lt";
  }

  function renderHoldTap(k) {
    const isMt = k.behavior === "mt";
    fillKeySelect($("#z-ht-hold"), isMt ? k.params[0] : "LCTRL", (d) => d.category === "Modifiers" && d.code !== "CAPS");
    fillKeySelect($("#z-ht-tap"), isMt ? k.params[1] : k.behavior === "kp" ? k.params[0] : "ESC");
    $("#z-ht-apply").disabled = !state.km.has("mt");
  }

  function renderMore(k) {
    const box = $("#z-more");
    box.textContent = "";
    const opts = [
      ["caps_word", [], "Caps Word"], ["key_repeat", [], "Key Repeat"],
      ...["LCLK", "RCLK", "MCLK", "MB4", "MB5"].map((b) => ["mkp", [b], `Mouse ${{ LCLK: "left", RCLK: "right", MCLK: "middle", MB4: "back", MB5: "forward" }[b]} click`]),
      ...[0, 1, 2, 3, 4].map((n) => ["bt", ["BT_SEL", `${n}`], `Bluetooth profile ${n + 1}`]),
      ["bt", ["BT_CLR"], "Bluetooth: clear current profile"], ["bt", ["BT_NXT"], "Bluetooth: next profile"], ["bt", ["BT_PRV"], "Bluetooth: previous profile"],
      ["out", ["OUT_USB"], "Output: USB"], ["out", ["OUT_BLE"], "Output: Bluetooth"], ["out", ["OUT_TOG"], "Output: toggle"],
      ["bl", ["BL_TOG"], "Backlight on/off"], ["bl", ["BL_INC"], "Backlight brighter"], ["bl", ["BL_DEC"], "Backlight dimmer"],
      ["rgb_ug", ["RGB_TOG"], "Indicator lights on/off"], ["stp", ["STP_BAT"], "Show battery level"],
      ["studio_unlock", [], "Studio unlock"], ["bootloader", [], "Bootloader (firmware updates)"],
      ...state.km.customBehaviors().filter((c) => c.cells === 0).map((c) => [c.label, [], c.displayName]),
    ].filter(([b]) => state.km.has(b));
    for (const [behavior, params, label] of opts) {
      const b = document.createElement("button");
      b.textContent = label;
      const cur = binding(state.layer, state.selected);
      if (cur.behavior === behavior && cur.params.join() === params.join()) b.classList.add("on");
      b.onclick = () => {
        if (behavior === "bootloader" && !confirm("A Bootloader key restarts that half into firmware-update mode. Add it anyway?")) return;
        setBinding(state.selected, { behavior, params });
      };
      box.appendChild(b);
    }
  }

  function render() {
    renderChrome();
    if (state.status === "ready") {
      renderBoard();
      renderInspector();
    }
  }

  // ---------------------------------------------------------------------------
  // Layers

  function renameLayer() {
    const l = state.km.layers[state.layer];
    const name = prompt("Layer name", l.name);
    if (name == null || name === l.name) return;
    const limited = name.slice(0, Math.max(state.km.maxLayerNameLength, 1));
    run(async () => {
      await state.conn.call({ type: "setLayerName", id: l.id, name: limited });
      l.name = limited;
      state.unsaved = true;
    });
  }

  // ---------------------------------------------------------------------------
  // Events

  function bind() {
    $("#z-connect").onclick = () => root.App.connectPro();
    $("#z-connect-big").onclick = () => root.App.connectPro();
    $("#z-demo").onclick = () => root.App.demoPro();
    $("#z-disconnect").onclick = () => detach(false);
    $("#z-sim-unlock").onclick = () => state.sim?.unlock();
    $("#z-keep").onclick = () => run(async () => {
      await state.conn.call({ type: "save" }, 10000);
      state.unsaved = false;
    }, "Saved on the keyboard. It keeps working over Bluetooth without this page.");
    $("#z-revert").onclick = () => run(async () => {
      await state.conn.call({ type: "discard" });
      state.unsaved = false;
      await load();
    }, "Reverted to what's saved on the keyboard.");

    $("#z-add-layer").onclick = () => run(async () => {
      const r = await state.conn.call({ type: "addLayer" });
      const name = `Layer ${r.index}`;
      try { await state.conn.call({ type: "setLayerName", id: r.layer.id, name }); r.layer.name = name; } catch { /* keep blank */ }
      state.km.layers.splice(r.index, 0, r.layer);
      state.km.availableLayers = Math.max(0, state.km.availableLayers - 1);
      state.layer = r.index;
      state.unsaved = true;
    }, "Layer added. Map a key to it with the Layer tab.");
    $("#z-rename-layer").onclick = renameLayer;
    $("#z-remove-layer").onclick = () => {
      const l = state.km.layers[state.layer];
      if (!confirm(`Remove the layer “${l.name || state.layer}”? Keys that switch to it will stop working.`)) return;
      run(async () => {
        await state.conn.call({ type: "removeLayer", index: state.layer });
        state.km.layers.splice(state.layer, 1);
        state.km.availableLayers++;
        state.layer = Math.max(0, state.layer - 1);
        state.selected = null;
        state.unsaved = true;
      });
    };

    $$("[data-z-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.zTab; renderInspector(); }));
    $("#z-deselect").onclick = () => { state.selected = null; state.capturing = false; render(); };
    $("#z-picker-search").oninput = (e) => { state.search = e.target.value; renderInspector(); };
    $$("#z-mods button").forEach((b) => (b.onclick = () => {
      state.modsTouched = true;
      state.mods.has(b.dataset.mod) ? state.mods.delete(b.dataset.mod) : state.mods.add(b.dataset.mod);
      renderInspector();
    }));
    $("#z-capture").onclick = () => { state.capturing = !state.capturing; renderInspector(); };
    $("#z-trans").onclick = () => setBinding(state.selected, { behavior: "trans", params: [] });
    $("#z-none").onclick = () => setBinding(state.selected, { behavior: "none", params: [] });
    $("#z-layer-kind").onchange = (e) => { $("#z-layer-tap-row").hidden = e.target.value !== "lt"; };
    $("#z-layer-apply").onclick = () => {
      const b = $("#z-layer-kind").value, layer = $("#z-layer-target").value;
      setBinding(state.selected, b === "lt" ? { behavior: "lt", params: [layer, $("#z-layer-tap").value] } : { behavior: b, params: [layer] });
    };
    $("#z-ht-apply").onclick = () => setBinding(state.selected, { behavior: "mt", params: [$("#z-ht-hold").value, $("#z-ht-tap").value] });

    Board.interact($("#z-board"), {
      onSelect: (pos) => {
        state.selected = pos;
        state.capturing = false;
        state.modsTouched = false;
        render();
      },
      onSwap: (a, b) => {
        const ka = binding(state.layer, a), kb = binding(state.layer, b);
        run(async () => {
          const layerID = state.km.layers[state.layer].id;
          const ra = state.km.toStudio(kb), rb = state.km.toStudio(ka);
          await state.conn.call({ type: "setBinding", layerID, position: a, binding: ra });
          await state.conn.call({ type: "setBinding", layerID, position: b, binding: rb });
          state.km.layers[state.layer].bindings[a] = ra;
          state.km.layers[state.layer].bindings[b] = rb;
          state.unsaved = true;
        }, `Swapped ${posName(a)} and ${posName(b)}`);
      },
    });
  }

  function onKeyDown(e) {
    if (state.capturing && state.selected != null) {
      e.preventDefault();
      const expr = HID.exprForEvent(e);
      if (!expr) {
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return true;
        ui.toast(`The browser can't tell which key that was (${e.code || e.key}). Pick it from the list.`);
        return true;
      }
      // Wait for the non-modifier key unless only a modifier was pressed and released.
      if (HID.isModifierKey(expr) && (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey)) {
        state.pendingModifier = expr;
        return true;
      }
      state.capturing = false;
      setBinding(state.selected, { behavior: "kp", params: [expr] });
      return true;
    }
    if (e.key === "Escape" && state.selected != null && !e.target.closest?.("input, textarea, select")) {
      state.selected = null;
      render();
      return true;
    }
    return false;
  }

  function onKeyUp(e) {
    if (state.capturing && state.pendingModifier && HID.codeForBrowser(e.code) === state.pendingModifier) {
      const expr = state.pendingModifier;
      state.pendingModifier = null;
      state.capturing = false;
      setBinding(state.selected, { behavior: "kp", params: [expr] });
    }
  }

  let bound = false;
  root.ZmkEditor = {
    activate() {
      if (!bound) { bind(); bound = true; }
      render();
    },
    attach,
    detach,
    isConnected: () => !!state.conn,
    isDirty: () => state.unsaved,
    onKeyDown,
    onKeyUp,
    pressToken(code, down) {
      const key = HID.codeForBrowser(code);
      if (key) down ? state.pressed.add(key) : state.pressed.delete(key);
      if (state.status === "ready") renderBoard();
      return key ? HID.lookup(key).name : null;
    },
    clearPressed() { state.pressed.clear(); if (state.status === "ready") renderBoard(); },
    helpHTML() {
      return `<h2>Editing your Advantage360 Pro</h2><ol>
        <li>Use Chrome, Edge or another Chromium browser (they support Web Serial). Connect the <b>left half</b> with a USB data cable.</li>
        <li>Click <b>Connect keyboard…</b> and pick the Advantage360 Pro in the list.</li>
        <li>Unlock editing on the keyboard: <b>hold Mod and press Esc</b> (on the stock layout).</li>
        <li>Click a key and choose what it should do. Changes are live on the keyboard immediately.</li>
        <li>Click <b>Keep Changes</b> to store them on the keyboard, or <b>Revert</b> to undo everything since the last save.</li>
      </ol>
      <p>Live editing needs Kinesis' ZMK Studio-enabled firmware (“Clique” firmware). Older keyboards need <a href="https://kinesis-ergo.com/360p-clique-upgrade/" target="_blank" rel="noopener">Kinesis' one-time update</a>.</p>`;
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
