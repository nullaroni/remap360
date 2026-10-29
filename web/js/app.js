// Remap360 for Advantage2: browser UI.
(function () {
  "use strict";

  const T = window.A2Tokens;
  const { LayoutFile, familyForFilename } = window.A2Layout;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const SVGNS = "http://www.w3.org/2000/svg";
  const UNIT = 56;
  const LS_DRAFT = "remap360.a2.draft";
  const LS_BACKUPS = "remap360.a2.backups";
  const LS_OS = "remap360.a2.os";
  const IGNORED_FILES = new Set(["state.txt", "version.txt", "do_not_edit.txt"]);

  const isMacPlatform = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || "");

  const state = {
    file: new LayoutFile(""),
    fileName: "qwerty.txt",
    fileHandle: null,
    dirHandle: null,
    dirFiles: [],
    savedText: "",
    family: "qwerty",
    layer: "top",
    os: localStorage.getItem(LS_OS) || (isMacPlatform ? "mac" : "win"),
    selected: null,
    tab: "remap",
    category: "All",
    search: "",
    capturing: false,
    history: [],
    future: [],
    pressed: new Set(),
  };

  // ---------------------------------------------------------------------------
  // Helpers

  const mac = () => state.os === "mac";
  const locs = () => T.locations(state.family, state.layer);
  const selectedLoc = () => (state.selected == null ? null : locs()[state.selected]);
  const isDirty = () => state.file.toString() !== state.savedText;

  function toast(msg, ms = 3200) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (el.hidden = true), ms);
  }

  function svg(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  function keyName(loc) {
    return T.describe(T.defaultAction(loc), mac()).name;
  }

  /** Applies a change to the layout file, recording it for undo. */
  function edit(fn, message) {
    const before = state.file.toString();
    const next = state.file.clone();
    fn(next);
    if (next.toString() === before) return;
    state.history.push(before);
    if (state.history.length > 200) state.history.shift();
    state.future = [];
    state.file = next;
    saveDraft();
    render();
    if (message) toast(message);
  }

  function replaceText(text, { recordUndo = true } = {}) {
    const before = state.file.toString();
    if (text === before) return;
    if (recordUndo) {
      state.history.push(before);
      state.future = [];
    }
    state.file = new LayoutFile(text);
    saveDraft();
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(state.file.toString());
    state.file = new LayoutFile(state.history.pop());
    saveDraft();
    render();
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(state.file.toString());
    state.file = new LayoutFile(state.future.pop());
    saveDraft();
    render();
  }

  function saveDraft() {
    try {
      localStorage.setItem(LS_DRAFT, JSON.stringify({
        name: state.fileName, family: state.family, text: state.file.toString(), savedText: state.savedText,
      }));
    } catch { /* storage full or disabled */ }
  }

  function backups() {
    try { return JSON.parse(localStorage.getItem(LS_BACKUPS) || "[]"); } catch { return []; }
  }

  function addBackup(name, text) {
    const list = backups();
    if (list.length && list[0].name === name && list[0].text === text) return;
    list.unshift({ name, text, time: new Date().toISOString() });
    try { localStorage.setItem(LS_BACKUPS, JSON.stringify(list.slice(0, 40))); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Keyboard

  function keyKind(loc) {
    if (T.NOT_PROGRAMMABLE.has(loc)) return "fixed";
    const b = state.file.binding(loc);
    if (state.file.singleMacro(loc)) return "macro";
    if (b && b.kind === "taphold") return "taphold";
    if (b && b.action === "null") return "disabled";
    if (b) return "remapped";
    if (state.file.macrosFor(loc).length) return "macro";
    return "default";
  }

  function fitText(text, width) {
    const len = [...text].length;
    if (len <= 2) return 19;
    if (len <= 4) return Math.min(15, (width * UNIT) / (len * 0.62));
    return Math.max(8.5, Math.min(13, (width * UNIT) / (len * 0.62)));
  }

  function renderBoard() {
    const board = $("#board");
    board.textContent = "";
    const pad = 0.3;
    const width = 17.5 + pad * 2, height = 9.6 + pad * 2;
    board.setAttribute("viewBox", `${-pad * UNIT} ${-pad * UNIT} ${width * UNIT} ${height * UNIT}`);

    const groups = {
      fn: svg("g", { class: "grp-fn" }, board),
      well: svg("g", { class: "grp-well" }, board),
    };
    for (const [name, g] of Object.entries(T.THUMB_GROUPS)) {
      groups[name] = svg("g", {
        transform: `translate(${g.x * UNIT} ${g.y * UNIT}) rotate(${g.rotate}) translate(${-(g.originX || 0) * UNIT} 0)`,
      }, board);
    }

    const tokens = locs();
    tokens.forEach((loc, i) => {
      const geo = T.GEOMETRY[i];
      const kind = keyKind(loc);
      const action = state.file.actionFor(loc);
      const d = T.describe(action, mac());
      const g = svg("g", {
        class: `key k-${kind}${state.selected === i ? " selected" : ""}${state.pressed.has(action) ? " pressed" : ""}${d.mod ? " mod" : ""}`,
        transform: `translate(${geo.x * UNIT} ${geo.y * UNIT})`,
        "data-pos": i,
        tabindex: kind === "fixed" ? -1 : 0,
        role: "button",
        "aria-label": `${keyName(loc)}: ${d.name}`,
      }, groups[geo.group]);
      const w = geo.w * UNIT, h = geo.h * UNIT, inset = 2.5;
      svg("rect", { class: "cap-bg", x: inset, y: inset, width: w - inset * 2, height: h - inset * 2, rx: 7 }, g);
      svg("rect", { class: "cap-top", x: inset + 3, y: inset + 2, width: w - inset * 2 - 6, height: h - inset * 2 - 7, rx: 5 }, g);

      const binding = state.file.binding(loc);
      const macro = state.file.singleMacro(loc);
      let main = d.label;
      if (macro) main = "Macro";
      const size = geo.group === "fn" ? Math.min(11, fitText(main, geo.w)) : fitText(main, geo.w);
      const label = svg("text", { class: "legend-main", x: w / 2, y: h / 2 - 1 + size * 0.35, "font-size": size }, g);
      label.textContent = main;

      if (kind !== "default" && kind !== "fixed" && geo.group !== "fn") {
        const orig = svg("text", { class: "legend-orig", x: 7, y: 15 }, g);
        orig.textContent = T.describe(T.defaultAction(loc), mac()).label;
      }
      if (binding && binding.kind === "taphold" && !macro) {
        const hold = svg("text", { class: "legend-hold", x: w / 2, y: h - 9 }, g);
        hold.textContent = `hold ${T.describe(binding.hold, mac()).label}`;
      } else if (d.shifted && geo.group !== "fn" && !macro) {
        const sh = svg("text", { class: "legend-shift", x: w - 8, y: 15 }, g);
        sh.textContent = d.shifted;
      }
      const title = svg("title", {}, g);
      title.textContent = `${keyName(loc)} [${loc}] → ${macro ? "macro" : d.name}`;
    });
  }

  // ---------------------------------------------------------------------------
  // Inspector

  function renderInspector() {
    const loc = selectedLoc();
    $("#inspector-empty").hidden = loc != null;
    $("#inspector-key").hidden = loc == null;
    if (loc == null) return;

    const action = state.file.actionFor(loc);
    const d = T.describe(action, mac());
    const binding = state.file.binding(loc);
    $("#key-title").textContent = `${keyName(loc)} key${state.layer === "keypad" ? " (keypad layer)" : ""}`;
    $("#key-token").textContent = `[${loc}]`;
    const macro = state.file.singleMacro(loc);
    $("#key-cap").textContent = macro ? "Macro" : d.label;
    $("#key-cap").className = `cap k-${keyKind(loc)}`;

    const isMod = T.MODIFIER_LOCATIONS.has(loc);
    $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
    $$(".tab").forEach((p) => (p.hidden = p.dataset.panel !== state.tab));
    $("#btn-capture").textContent = state.capturing ? "Press any key… (click to cancel)" : "Press a key…";
    $("#btn-capture").classList.toggle("armed", state.capturing);
    $("#btn-reset").disabled = keyKind(loc) === "default";

    if (state.tab === "remap") renderPicker(action);
    if (state.tab === "taphold") {
      fillActionSelect($("#th-tap"), binding?.kind === "taphold" ? binding.tap : action);
      fillActionSelect($("#th-hold"), binding?.kind === "taphold" ? binding.hold : "lctrl");
      $("#th-delay").value = binding?.kind === "taphold" ? binding.delay : 250;
      $("#th-clear").disabled = binding?.kind !== "taphold";
    }
    if (state.tab === "macro") renderMacroPanel(loc, isMod);
  }

  function renderPicker(current) {
    const cats = $("#picker-cats");
    cats.textContent = "";
    for (const c of ["All", ...T.CATEGORIES]) {
      const b = document.createElement("button");
      b.textContent = c;
      b.className = c === state.category ? "on" : "";
      b.onclick = () => { state.category = c; renderInspector(); };
      cats.appendChild(b);
    }
    const q = state.search.trim().toLowerCase();
    const grid = $("#picker");
    grid.textContent = "";
    for (const def of T.ACTIONS) {
      const d = T.describe(def.token, mac());
      if (state.category !== "All" && def.category !== state.category) continue;
      if (q && ![d.token, d.label, d.name, def.name, def.category].some((s) => s.toLowerCase().includes(q))) continue;
      const b = document.createElement("button");
      b.className = `pick${def.token === current ? " on" : ""}`;
      b.title = `${d.name} [${def.token}]`;
      b.innerHTML = `<span class="pick-label"></span><span class="pick-name"></span>`;
      b.firstChild.textContent = def.icon || d.label;
      b.lastChild.textContent = d.name === d.label ? "" : d.name;
      b.onclick = () => assign(def.token);
      grid.appendChild(b);
    }
    if (!grid.children.length) grid.innerHTML = `<p class="muted">No matching actions.</p>`;
  }

  function fillActionSelect(select, value) {
    select.textContent = "";
    for (const cat of T.CATEGORIES) {
      const og = document.createElement("optgroup");
      og.label = cat;
      for (const def of T.ACTIONS.filter((x) => x.category === cat)) {
        const o = document.createElement("option");
        o.value = def.token;
        o.textContent = `${T.describe(def.token, mac()).name}`;
        og.appendChild(o);
      }
      select.appendChild(og);
    }
    if (![...select.options].some((o) => o.value === value)) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = T.describe(value, mac()).name;
      select.prepend(o);
    }
    select.value = value;
  }

  function modifierLocations() {
    return locs().filter((l) => T.MODIFIER_LOCATIONS.has(l) && !["kp-lwin", "kp-ralt"].includes(l));
  }

  function renderMacroPanel(loc, isMod) {
    const panel = $('[data-panel="macro"]');
    const mods = $("#macro-mods");
    const checked = new Set($$("input:checked", mods).map((i) => i.value));
    $$("label", mods).forEach((l) => l.remove());
    $("#macro-apply").disabled = isMod;
    if (isMod) {
      panel.querySelector(".note").textContent = "Modifier keys can't trigger a macro on their own. Pick another key, then hold this one with it.";
    } else {
      panel.querySelector(".note").textContent = "Macros play when the trigger is pressed. Tick modifiers to play the macro only with that combination.";
    }
    for (const m of modifierLocations()) {
      const l = document.createElement("label");
      l.className = "chk";
      l.innerHTML = `<input type="checkbox" value="${m}"> <span></span>`;
      l.lastChild.textContent = keyName(m);
      l.firstChild.checked = checked.has(m);
      mods.appendChild(l);
    }
    const list = $("#macro-list");
    list.textContent = "";
    for (const m of state.file.macrosFor(loc)) {
      const li = document.createElement("li");
      const trig = m.trigger.map((t) => keyName(t)).join(" + ");
      const text = T.macroToText(m.body);
      li.innerHTML = `<button class="link load"></button><button class="link danger del" title="Remove">✕</button>`;
      li.firstChild.textContent = `${trig}: ${text != null ? `“${text}”` : m.body.map((t) => `{${t}}`).join("")}`;
      li.firstChild.onclick = () => loadMacro(m);
      li.lastChild.onclick = () => edit((f) => f.setMacro(m.trigger, []), "Macro removed");
      list.appendChild(li);
    }
    const single = state.file.singleMacro(loc);
    if (!panel.dataset.loaded || panel.dataset.loaded !== loc) {
      panel.dataset.loaded = loc;
      if (single) loadMacro(single);
      else {
        $$("#macro-mods input").forEach((i) => (i.checked = false));
        $("#macro-text").value = "";
        $("#macro-tokens").value = "";
      }
    }
  }

  function loadMacro(m) {
    $$("#macro-mods input").forEach((i) => (i.checked = m.trigger.includes(i.value)));
    $("#macro-tokens").value = m.body.map((t) => `{${t}}`).join("");
    $("#macro-text").value = T.macroToText(m.body) ?? "";
  }

  function macroTrigger() {
    const mods = $$("#macro-mods input").filter((i) => i.checked).map((i) => i.value);
    return [...mods, selectedLoc()];
  }

  function assign(token) {
    const loc = selectedLoc();
    if (!loc) return;
    edit((f) => f.setAction(loc, token));
  }

  // ---------------------------------------------------------------------------
  // Source view and problems

  function renderSource() {
    const src = $("#source");
    const text = state.file.toString();
    if (document.activeElement !== src && src.value !== text) src.value = text;
    const { remaps, macros } = state.file.stats();
    $("#stats").textContent = `${remaps} remap${remaps === 1 ? "" : "s"} · ${macros} macro${macros === 1 ? "" : "s"}`;
    const probs = state.file.problems();
    const ul = $("#problems");
    ul.textContent = "";
    for (const p of probs) {
      const li = document.createElement("li");
      li.textContent = `Line ${p.line}: ${p.problem} — ${p.text}`;
      ul.appendChild(li);
    }
  }

  function renderChrome() {
    $("#file-name").textContent = state.fileHandle || state.dirHandle
      ? state.fileName
      : `${state.fileName} (not on the keyboard yet)`;
    $("#dirty").hidden = !isDirty();
    $("#btn-save").disabled = !isDirty() && !!state.fileHandle;
    $("#btn-undo").disabled = !state.history.length;
    $("#btn-redo").disabled = !state.future.length;
    $$("[data-layer]").forEach((b) => b.classList.toggle("on", b.dataset.layer === state.layer));
    $$("[data-family]").forEach((b) => b.classList.toggle("on", b.dataset.family === state.family));
    $$("[data-os]").forEach((b) => b.classList.toggle("on", b.dataset.os === state.os));
    const sel = $("#file-select");
    sel.hidden = state.dirFiles.length < 2;
    $("#file-name").hidden = !sel.hidden;
    if (!sel.hidden) {
      sel.textContent = "";
      for (const f of state.dirFiles) {
        const o = document.createElement("option");
        o.value = f.name;
        o.textContent = f.name;
        sel.appendChild(o);
      }
      sel.value = state.fileName;
    }
    document.title = `${isDirty() ? "• " : ""}${state.fileName} — Remap360 for Advantage2`;
  }

  function render() {
    renderBoard();
    renderInspector();
    renderSource();
    renderChrome();
  }

  // ---------------------------------------------------------------------------
  // Files

  function loadText(text, name, { handle = null, family } = {}) {
    state.file = new LayoutFile(text);
    state.savedText = state.file.toString();
    state.fileName = name;
    state.fileHandle = handle;
    state.family = family || familyForFilename(name);
    state.history = [];
    state.future = [];
    state.selected = null;
    addBackup(name, text);
    saveDraft();
    render();
  }

  function confirmDiscard() {
    return !isDirty() || confirm("Discard your unsaved changes to this layout?");
  }

  async function openDrive() {
    if (!window.showDirectoryPicker) {
      toast("This browser can't open folders. Use Chrome or Edge, or use Open File… and Copy.", 5000);
      openHelp();
      return;
    }
    if (!confirmDiscard()) return;
    let dir;
    try {
      dir = await window.showDirectoryPicker({ id: "advantage2", mode: "readwrite" });
    } catch (e) {
      if (e.name !== "AbortError") toast(`Couldn't open the folder: ${e.message}`);
      return;
    }
    try {
      dir = await dir.getDirectoryHandle("active");
    } catch { /* already inside "active" */ }
    const files = [];
    for await (const [name, h] of dir.entries()) {
      if (h.kind !== "file" || name.startsWith(".") || !/\.txt$/i.test(name)) continue;
      if (IGNORED_FILES.has(name.toLowerCase())) continue;
      files.push({ name, handle: h });
    }
    const rank = (n) => (n.toLowerCase() === "qwerty.txt" ? 0 : n.toLowerCase() === "dvorak.txt" ? 1 : 2);
    files.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
    if (!files.length) {
      toast("No layout files there. Pick the ADVANTAGE2 drive or its “active” folder.", 5000);
      return;
    }
    state.dirHandle = dir;
    state.dirFiles = files;
    await openHandle(files[0].handle, files[0].name);
    toast(`Opened ${files.length} layout file${files.length === 1 ? "" : "s"} from the v-Drive`);
  }

  async function openHandle(handle, name) {
    const text = await (await handle.getFile()).text();
    loadText(text, name, { handle });
  }

  async function openFile() {
    if (!confirmDiscard()) return;
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({
          id: "advantage2", types: [{ description: "Advantage2 layout", accept: { "text/plain": [".txt"] } }],
        });
        state.dirHandle = null;
        state.dirFiles = [];
        await openHandle(h, h.name);
      } catch (e) {
        if (e.name !== "AbortError") toast(`Couldn't open the file: ${e.message}`);
      }
      return;
    }
    $("#file-input").click();
  }

  async function save() {
    const text = state.file.toString();
    if (state.fileHandle) {
      try {
        if ((await state.fileHandle.queryPermission?.({ mode: "readwrite" })) !== "granted") {
          const p = await state.fileHandle.requestPermission?.({ mode: "readwrite" });
          if (p && p !== "granted") throw new Error("Permission to edit the file was denied");
        }
        // Back up what's on the keyboard right now before overwriting it.
        try { addBackup(state.fileName, await (await state.fileHandle.getFile()).text()); } catch { /* ignore */ }
        const w = await state.fileHandle.createWritable();
        await w.write(text);
        await w.close();
        state.savedText = text;
        saveDraft();
        render();
        toast("Saved. Eject the v-Drive, then press progm + F1 to load it.", 6000);
      } catch (e) {
        toast(`Couldn't save: ${e.message}. Use Copy and paste into the file instead.`, 7000);
      }
      return;
    }
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({
          id: "advantage2", suggestedName: state.fileName,
          types: [{ description: "Advantage2 layout", accept: { "text/plain": [".txt"] } }],
        });
        state.fileHandle = h;
        state.fileName = h.name;
        return save();
      } catch (e) {
        if (e.name !== "AbortError") toast(`Couldn't save: ${e.message}`);
        return;
      }
    }
    download();
  }

  function download(text = state.file.toString(), name = state.fileName) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.file.toString());
      toast(`Copied. Paste it over the contents of ${state.fileName} on the v-Drive.`, 5000);
    } catch {
      $("#source").select();
      toast("Select the text below and copy it.");
    }
  }

  function openHelp() {
    const ul = $("#backup-list");
    ul.textContent = "";
    const list = backups();
    if (!list.length) ul.innerHTML = `<li class="muted">No backups yet.</li>`;
    list.forEach((b) => {
      const li = document.createElement("li");
      li.innerHTML = `<span></span> <button class="link">Download</button> <button class="link">Load</button>`;
      li.firstChild.textContent = `${b.name} · ${new Date(b.time).toLocaleString()}`;
      const [, dl, load] = li.children;
      dl.onclick = () => download(b.text, b.name.replace(/\.txt$/i, "") + `-backup.txt`);
      load.onclick = () => {
        replaceText(b.text);
        $("#help").close();
        render();
        toast(`Loaded the backup into the editor. Save to write it to ${state.fileName}.`, 5000);
      };
      ul.appendChild(li);
    });
    $("#help").showModal();
  }

  // ---------------------------------------------------------------------------
  // Presets

  const PRESETS = {
    mac: {
      label: "Mac thumb keys",
      apply: (f) => {
        const map = { lctrl: "lwin", rwin: "rctrl", rctrl: "rwin" };
        for (const [loc, to] of Object.entries(map)) {
          f.setAction(loc, to);
          f.setAction(`kp-${loc}`, to);
        }
      },
    },
    "caps-ctrl": { label: "Caps Lock → Ctrl", apply: (f) => f.setAction("caps", "lctrl") },
    "caps-esc": { label: "Caps Lock tap Esc / hold Ctrl", apply: (f) => f.setTapHold("caps", "escape", "lctrl", 250) },
    "no-caps": { label: "Caps Lock disabled", apply: (f) => f.setAction("caps", "null") },
  };

  // ---------------------------------------------------------------------------
  // Events

  function bind() {
    $("#btn-open-drive").onclick = openDrive;
    $("#btn-open-file").onclick = openFile;
    $("#file-input").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      state.dirHandle = null;
      state.dirFiles = [];
      loadText(await file.text(), file.name);
      e.target.value = "";
    };
    $("#file-select").onchange = async (e) => {
      const f = state.dirFiles.find((x) => x.name === e.target.value);
      if (!f || !confirmDiscard()) return render();
      await openHandle(f.handle, f.name);
    };
    $("#btn-save").onclick = save;
    $("#btn-copy").onclick = copy;
    $("#btn-download").onclick = () => download();
    $("#btn-undo").onclick = undo;
    $("#btn-redo").onclick = redo;
    $("#btn-help").onclick = openHelp;

    $$("[data-layer]").forEach((b) => (b.onclick = () => { state.layer = b.dataset.layer; state.selected = null; render(); }));
    $$("[data-family]").forEach((b) => (b.onclick = () => { state.family = b.dataset.family; saveDraft(); render(); }));
    $$("[data-os]").forEach((b) => (b.onclick = () => { state.os = b.dataset.os; localStorage.setItem(LS_OS, state.os); render(); }));
    $$("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; renderInspector(); }));
    $$("[data-preset]").forEach((b) => (b.onclick = () => {
      const p = PRESETS[b.dataset.preset];
      edit(p.apply, `Applied: ${p.label}`);
    }));
    $("#btn-deselect").onclick = () => { state.selected = null; state.capturing = false; render(); };

    $("#picker-search").oninput = (e) => { state.search = e.target.value; renderInspector(); };
    $("#btn-capture").onclick = () => { state.capturing = !state.capturing; renderInspector(); };
    $("#btn-disable").onclick = () => assign("null");
    $("#btn-reset").onclick = () => {
      const loc = selectedLoc();
      if (loc) edit((f) => f.reset(loc), `${keyName(loc)} is back to normal`);
    };

    $("#th-apply").onclick = () => {
      const delay = parseInt($("#th-delay").value, 10);
      if (!(delay >= 1 && delay <= 999)) return toast("The hold delay must be between 1 and 999 ms.");
      const loc = selectedLoc();
      edit((f) => f.setTapHold(loc, $("#th-tap").value, $("#th-hold").value, delay), "Tap & hold set");
    };
    $("#th-clear").onclick = () => {
      const loc = selectedLoc();
      edit((f) => f.setAction(loc, T.defaultAction(loc)), "Tap & hold removed");
    };

    $("#macro-text").oninput = (e) => {
      const tokens = T.textToMacro(e.target.value);
      if (tokens) $("#macro-tokens").value = tokens.map((t) => `{${t}}`).join("");
      e.target.classList.toggle("invalid", !tokens);
    };
    $("#macro-tokens").oninput = (e) => {
      const body = (e.target.value.match(/\{[^{}]*\}/g) || []).map((x) => x.slice(1, -1));
      $("#macro-text").value = T.macroToText(body) ?? "";
    };
    $("#macro-apply").onclick = () => {
      const raw = $("#macro-tokens").value.trim();
      const body = (raw.match(/\{[^{}]*\}/g) || []).map((x) => x.slice(1, -1));
      if (!body.length) return toast("Type some text or tokens for the macro first.");
      if (raw.replace(/\{[^{}]*\}/g, "").trim()) return toast("Tokens must each be wrapped in { }.");
      const bad = body.filter((t) => !T.isMacroToken(t));
      if (bad.length) return toast(`Unknown token${bad.length > 1 ? "s" : ""}: ${bad.map((t) => `{${t}}`).join(" ")}`, 5000);
      edit((f) => f.setMacro(macroTrigger(), body), "Macro saved");
    };
    $("#macro-clear").onclick = () => edit((f) => f.setMacro(macroTrigger(), []), "Macro removed");

    let sourceTimer;
    $("#source").oninput = (e) => {
      clearTimeout(sourceTimer);
      sourceTimer = setTimeout(() => {
        replaceText(e.target.value);
        renderBoard(); renderInspector(); renderSource(); renderChrome();
      }, 250);
    };
    $("#source").onblur = () => renderSource();

    bindBoard();
    bindTestPad();

    document.addEventListener("keydown", (e) => {
      if (state.capturing) {
        e.preventDefault();
        e.stopPropagation();
        const token = T.tokenForCode(e.code);
        state.capturing = false;
        if (token) assign(token);
        else { toast(`The browser can't tell which key that was (${e.code || e.key}). Pick it from the list.`); renderInspector(); }
        return;
      }
      const inField = e.target.closest?.("input, textarea, select, #testpad");
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
      if (inField) return;
      if (cmd && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (cmd && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (e.key === "Escape" && state.selected != null) { state.selected = null; render(); }
    }, true);

    window.addEventListener("beforeunload", (e) => {
      if (isDirty() && (state.fileHandle || state.dirHandle)) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  function bindBoard() {
    const board = $("#board");
    let drag = null;

    const posAt = (x, y) => {
      const k = document.elementFromPoint(x, y)?.closest?.(".key");
      return k ? +k.dataset.pos : null;
    };
    const programmable = (pos) => pos != null && !T.NOT_PROGRAMMABLE.has(locs()[pos]);

    board.addEventListener("pointerdown", (e) => {
      const k = e.target.closest(".key");
      if (!k || e.button !== 0) return;
      drag = { from: +k.dataset.pos, x: e.clientX, y: e.clientY, moved: false };
      board.setPointerCapture(e.pointerId);
    });
    board.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
        drag.moved = true;
        board.classList.add("dragging");
      }
      if (drag.moved) {
        const over = posAt(e.clientX, e.clientY);
        $$(".key.drop", board).forEach((el) => el.classList.remove("drop"));
        if (over != null && over !== drag.from) $(`.key[data-pos="${over}"]`, board)?.classList.add("drop");
      }
    });
    board.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const { from, moved } = drag;
      drag = null;
      board.classList.remove("dragging");
      if (!moved) return select(from);
      const to = posAt(e.clientX, e.clientY);
      if (to == null || to === from) return render();
      if (!programmable(from) || !programmable(to)) { toast("The Keypad and Program keys can't be moved."); return render(); }
      const [a, b] = [locs()[from], locs()[to]];
      edit((f) => f.swap(a, b), `Swapped ${keyName(a)} and ${keyName(b)}`);
    });
    board.addEventListener("keydown", (e) => {
      const k = e.target.closest(".key");
      if (k && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(+k.dataset.pos); }
    });
  }

  function select(pos) {
    const loc = locs()[pos];
    if (T.NOT_PROGRAMMABLE.has(loc)) {
      toast(loc === "keypd" ? "The Keypad key switches layers and can't be reprogrammed." : "The Program key can't be reprogrammed.");
      return;
    }
    state.selected = pos;
    state.capturing = false;
    if (state.tab === "macro") $('[data-panel="macro"]').dataset.loaded = "";
    render();
  }

  function bindTestPad() {
    const pad = $("#testpad");
    const log = [];
    pad.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") e.preventDefault();
      const token = T.tokenForCode(e.code);
      if (token) state.pressed.add(token);
      const d = token ? T.describe(token, mac()) : null;
      log.unshift(`${d ? d.name : "Unknown key"}  ·  code ${e.code || "?"}${e.key && e.key.length === 1 ? `  ·  “${e.key}”` : ""}`);
      log.length = Math.min(log.length, 6);
      pad.textContent = log.join("\n");
      renderBoard();
    });
    pad.addEventListener("keyup", (e) => {
      const token = T.tokenForCode(e.code);
      if (token) state.pressed.delete(token);
      renderBoard();
    });
    pad.addEventListener("blur", () => { state.pressed.clear(); renderBoard(); });
  }

  // ---------------------------------------------------------------------------
  // Start

  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_DRAFT) || "null");
      if (!d) return;
      state.file = new LayoutFile(d.text || "");
      state.fileName = d.name || "qwerty.txt";
      state.family = d.family || familyForFilename(state.fileName);
      state.savedText = d.savedText ?? "";
    } catch { /* ignore */ }
  }

  restoreDraft();
  bind();
  render();
})();
