// Layout-file editor for SmartSet keyboards (Advantage2, Advantage360 non-Pro).
// The keyboard specifics come from a model object (see adv2-model.js, adv360-model.js).
(function (root) {
  "use strict";

  const Board = root.Board;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const LS_DRAFT = "remap360.smartset.draft.";
  const LS_BACKUPS = "remap360.smartset.backups";

  const ui = root.UI;

  const state = {
    model: null,
    file: null,
    fileName: "",
    fileHandle: null,
    dirFiles: [],
    savedText: "",
    family: null,
    layer: null,
    selected: null,
    tab: "remap",
    category: "All",
    search: "",
    capturing: false,
    history: [],
    future: [],
    pressed: new Set(),
  };

  const view = () => $("#view-smartset");
  const mac = () => ui.os() === "mac";
  const m = () => state.model;
  const locs = () => m().locations(state.layer, state.family);
  const selectedLoc = () => (state.selected == null ? null : locs()[state.selected]);
  const isDirty = () => state.file && state.file.toString() !== state.savedText;
  const keyName = (loc) => m().locationName(loc, state.layer, mac());

  // ---------------------------------------------------------------------------
  // Edits, undo and persistence

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
    if (message) ui.toast(message);
  }

  function replaceText(text) {
    const before = state.file.toString();
    if (text === before) return;
    state.history.push(before);
    state.future = [];
    state.file = m().newFile(text);
    saveDraft();
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(state.file.toString());
    state.file = m().newFile(state.history.pop());
    saveDraft();
    render();
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(state.file.toString());
    state.file = m().newFile(state.future.pop());
    saveDraft();
    render();
  }

  function saveDraft() {
    try {
      localStorage.setItem(LS_DRAFT + m().id, JSON.stringify({
        name: state.fileName, family: state.family, text: state.file.toString(), savedText: state.savedText,
      }));
    } catch { /* storage unavailable */ }
  }

  function backups() {
    try { return JSON.parse(localStorage.getItem(LS_BACKUPS) || "[]"); } catch { return []; }
  }

  function addBackup(name, text) {
    const list = backups();
    if (list.length && list[0].name === name && list[0].text === text && list[0].model === m().id) return;
    list.unshift({ model: m().id, name, text, time: new Date().toISOString() });
    try { localStorage.setItem(LS_BACKUPS, JSON.stringify(list.slice(0, 40))); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Keyboard drawing

  function keyKind(loc) {
    if (m().isFixed(loc)) return "fixed";
    const b = state.file.binding(state.layer, loc);
    if (state.file.singleMacro(state.layer, loc)) return "macro";
    if (b && b.kind === "taphold") return "taphold";
    if (b && b.action === m().nullToken) return "disabled";
    if (b) return "remapped";
    if (state.file.macrosFor(state.layer, loc).length) return "macro";
    return "default";
  }

  function capFor(loc, i) {
    const kind = keyKind(loc);
    const action = state.file.actionFor(state.layer, loc);
    const d = m().describe(action, mac());
    const binding = state.file.binding(state.layer, loc);
    const macro = state.file.singleMacro(state.layer, loc);
    let label = macro ? "Macro" : d.label;
    // Unassigned keys like hotkeys show their own name instead of "—".
    if (kind === "default" && action === m().nullToken) label = m().locationLabel(loc, mac());
    if (kind === "fixed") label = m().locationLabel(loc, mac());
    const changed = kind !== "default" && kind !== "fixed";
    const classes = [];
    if (state.selected === i) classes.push("selected");
    if (state.pressed.has(action)) classes.push("pressed");
    if (d.mod) classes.push("mod");
    if (kind === "default" && action !== m().defaultAction(loc, "base") && state.layer !== m().layers[0].id) classes.push("layer-default");
    return {
      label,
      kind,
      classes,
      fixed: kind === "fixed",
      corner: changed ? m().locationLabel(loc, mac()) : null,
      hold: binding && binding.kind === "taphold" && !macro ? `hold ${m().describe(binding.hold, mac()).label}` : null,
      shifted: !macro && d.shifted,
      title: `${keyName(loc)} [${loc}] → ${macro ? "macro" : d.name}`,
      ariaLabel: `${keyName(loc)}: ${macro ? "macro" : d.name}`,
    };
  }

  function renderBoard() {
    Board.render($("#ss-board"), { keys: m().keys, size: m().size, caps: locs().map(capFor) });
  }

  // ---------------------------------------------------------------------------
  // Inspector

  function renderInspector() {
    const loc = selectedLoc();
    $("#ss-inspector-empty").hidden = loc != null;
    $("#ss-inspector-key").hidden = loc == null;
    if (loc == null) return renderPresets();

    const action = state.file.actionFor(state.layer, loc);
    const d = m().describe(action, mac());
    const binding = state.file.binding(state.layer, loc);
    const layerName = m().layers.find((l) => l.id === state.layer).name;
    $("#ss-key-title").textContent = `${keyName(loc)} key`;
    $("#ss-key-token").textContent = `[${loc}] · ${layerName}`;
    const macro = state.file.singleMacro(state.layer, loc);
    $("#ss-key-cap").textContent = macro ? "Macro" : d.label;
    $("#ss-key-cap").className = `cap k-${keyKind(loc)}`;

    $$("[data-ss-tab]").forEach((b) => b.classList.toggle("on", b.dataset.ssTab === state.tab));
    $$("[data-ss-panel]").forEach((p) => (p.hidden = p.dataset.ssPanel !== state.tab));
    $("#ss-capture").textContent = state.capturing ? "Press any key… (click to cancel)" : "Press a key…";
    $("#ss-capture").classList.toggle("armed", state.capturing);
    $("#ss-reset").disabled = keyKind(loc) === "default";

    if (state.tab === "remap") renderPicker(action);
    if (state.tab === "taphold") {
      fillActionSelect($("#ss-th-tap"), binding?.kind === "taphold" ? binding.tap : action);
      const holdDefault = m().ACTIONS.find((x) => /ctrl|ctr/.test(x.token) && x.mod)?.token;
      fillActionSelect($("#ss-th-hold"), binding?.kind === "taphold" ? binding.hold : holdDefault);
      $("#ss-th-delay").value = binding?.kind === "taphold" ? binding.delay : 250;
      $("#ss-th-clear").disabled = binding?.kind !== "taphold";
    }
    if (state.tab === "macro") renderMacroPanel(loc);
  }

  function renderPresets() {
    const box = $("#ss-presets");
    box.textContent = "";
    for (const p of m().presets) {
      const b = document.createElement("button");
      b.textContent = p.label;
      b.onclick = () => edit(p.apply, `Applied: ${p.label}`);
      box.appendChild(b);
    }
    $("#ss-layer-note").textContent = m().layerNote || "";
    $("#ss-layer-note").hidden = !m().layerNote;
  }

  function renderPicker(current) {
    const cats = $("#ss-picker-cats");
    cats.textContent = "";
    for (const c of ["All", ...m().CATEGORIES]) {
      const b = document.createElement("button");
      b.textContent = c;
      b.className = c === state.category ? "on" : "";
      b.onclick = () => { state.category = c; renderInspector(); };
      cats.appendChild(b);
    }
    const q = state.search.trim().toLowerCase();
    const grid = $("#ss-picker");
    grid.textContent = "";
    for (const def of m().ACTIONS) {
      const d = m().describe(def.token, mac());
      if (state.category !== "All" && def.category !== state.category) continue;
      if (q && ![d.token, d.label, d.name, def.name, def.category].some((s) => s.toLowerCase().includes(q))) continue;
      grid.appendChild(ui.pickButton(d.label, d.name === d.label ? "" : d.name, `${d.name} [${def.token}]`,
        def.token === current, () => assign(def.token)));
    }
    if (!grid.children.length) grid.innerHTML = `<p class="muted">No matching actions.</p>`;
  }

  function fillActionSelect(select, value) {
    select.textContent = "";
    for (const cat of m().CATEGORIES) {
      const og = document.createElement("optgroup");
      og.label = cat;
      for (const def of m().ACTIONS.filter((x) => x.category === cat)) {
        const o = document.createElement("option");
        o.value = def.token;
        o.textContent = m().describe(def.token, mac()).name;
        og.appendChild(o);
      }
      select.appendChild(og);
    }
    if (value && ![...select.options].some((o) => o.value === value)) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = m().describe(value, mac()).name;
      select.prepend(o);
    }
    if (value) select.value = value;
  }

  function renderMacroPanel(loc) {
    const panel = $('[data-ss-panel="macro"]');
    const mods = $("#ss-macro-mods");
    const checked = new Set($$("input:checked", mods).map((i) => i.value));
    $$("label", mods).forEach((l) => l.remove());
    const isMod = m().isModifierLocation(loc);
    $("#ss-macro-apply").disabled = isMod;
    $("#ss-macro-note").textContent = isMod
      ? "Modifier keys can't trigger a macro on their own. Pick another key, then hold this one with it."
      : "Macros play when the trigger is pressed. Tick modifiers to play the macro only with that combination.";
    $("#ss-macro-help").innerHTML = m().macroHelp;
    for (const mod of m().modifierLocations(state.layer, state.family)) {
      const l = document.createElement("label");
      l.className = "chk";
      l.innerHTML = `<input type="checkbox"> <span></span>`;
      l.firstChild.value = mod;
      l.lastChild.textContent = keyName(mod);
      l.firstChild.checked = checked.has(mod);
      mods.appendChild(l);
    }
    const list = $("#ss-macro-list");
    list.textContent = "";
    for (const mac0 of state.file.macrosFor(state.layer, loc)) {
      const li = document.createElement("li");
      const trig = mac0.trigger.map((t) => keyName(t)).join(" + ");
      const text = m().macroToText(mac0.body);
      li.innerHTML = `<button class="link load"></button><button class="link danger del" title="Remove">✕</button>`;
      li.firstChild.textContent = `${trig}: ${text != null ? `“${text}”` : mac0.body.map((t) => `{${t}}`).join("")}`;
      li.firstChild.onclick = () => loadMacro(mac0);
      li.lastChild.onclick = () => edit((f) => f.setMacro(state.layer, mac0.trigger, []), "Macro removed");
      list.appendChild(li);
    }
    const key = `${m().id}:${state.layer}:${loc}`;
    if (panel.dataset.loaded !== key) {
      panel.dataset.loaded = key;
      const single = state.file.singleMacro(state.layer, loc);
      if (single) loadMacro(single);
      else {
        $$("#ss-macro-mods input").forEach((i) => (i.checked = false));
        $("#ss-macro-text").value = "";
        $("#ss-macro-tokens").value = "";
      }
    }
  }

  function loadMacro(mc) {
    $$("#ss-macro-mods input").forEach((i) => (i.checked = mc.trigger.includes(i.value)));
    $("#ss-macro-tokens").value = mc.body.map((t) => `{${t}}`).join("");
    $("#ss-macro-text").value = m().macroToText(mc.body) ?? "";
  }

  function assign(token) {
    const loc = selectedLoc();
    if (loc) edit((f) => f.setAction(state.layer, loc, token));
  }

  // ---------------------------------------------------------------------------
  // Source view and chrome

  function renderSource() {
    const src = $("#ss-source");
    const text = state.file.toString();
    if (document.activeElement !== src && src.value !== text) src.value = text;
    const { remaps, macros } = state.file.stats();
    $("#ss-stats").textContent = `${remaps} remap${remaps === 1 ? "" : "s"} · ${macros} macro${macros === 1 ? "" : "s"}`;
    const ul = $("#ss-problems");
    ul.textContent = "";
    for (const p of state.file.problems()) {
      const li = document.createElement("li");
      li.textContent = `Line ${p.line}: ${p.problem} — ${p.text}`;
      ul.appendChild(li);
    }
  }

  function renderChrome() {
    const onDrive = !!state.fileHandle;
    $("#ss-file-name").textContent = onDrive ? state.fileName : `${state.fileName} (not on the keyboard yet)`;
    $("#ss-dirty").hidden = !isDirty();
    $("#ss-save").disabled = !isDirty() && onDrive;
    $("#ss-undo").disabled = !state.history.length;
    $("#ss-redo").disabled = !state.future.length;

    const layers = $("#ss-layers");
    layers.textContent = "";
    for (const l of m().layers) {
      const b = document.createElement("button");
      b.textContent = l.name;
      b.className = l.id === state.layer ? "on" : "";
      b.onclick = () => { state.layer = l.id; state.selected = null; render(); };
      layers.appendChild(b);
    }
    const fam = $("#ss-families");
    fam.hidden = !m().families;
    fam.textContent = "";
    for (const f of m().families || []) {
      const b = document.createElement("button");
      b.textContent = f === "qwerty" ? "QWERTY" : "Dvorak";
      b.className = f === state.family ? "on" : "";
      b.onclick = () => { state.family = f; saveDraft(); render(); };
      fam.appendChild(b);
    }

    const sel = $("#ss-file-select");
    sel.hidden = state.dirFiles.length < 2;
    $("#ss-file-name").hidden = !sel.hidden;
    if (!sel.hidden) {
      sel.textContent = "";
      for (const f of state.dirFiles) {
        const o = document.createElement("option");
        o.value = o.textContent = f.name;
        sel.appendChild(o);
      }
      sel.value = state.fileName;
    }
    ui.setTitle(`${isDirty() ? "• " : ""}${state.fileName}`);
  }

  function render() {
    if (!m()) return;
    renderBoard();
    renderInspector();
    renderSource();
    renderChrome();
  }

  // ---------------------------------------------------------------------------
  // Files

  function loadText(text, name, handle = null) {
    state.file = m().newFile(text);
    state.savedText = state.file.toString();
    state.fileName = name;
    state.fileHandle = handle;
    state.family = m().families ? m().familyForFilename(name) : null;
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

  async function openHandle(handle, name) {
    loadText(await (await handle.getFile()).text(), name, handle);
  }

  /** Opens the layout files in a v-Drive folder that main.js matched to this model. */
  async function openFolder(files) {
    const rank = m().drive.rank;
    files.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, undefined, { numeric: true }));
    state.dirFiles = files;
    await openHandle(files[0].handle, files[0].name);
    ui.toast(`Opened ${files.length} layout file${files.length === 1 ? "" : "s"} from the ${m().name} v-Drive`);
  }

  async function save() {
    const text = state.file.toString();
    if (state.fileHandle) {
      try {
        if ((await state.fileHandle.queryPermission?.({ mode: "readwrite" })) !== "granted") {
          const p = await state.fileHandle.requestPermission?.({ mode: "readwrite" });
          if (p && p !== "granted") throw new Error("permission to edit the file was denied");
        }
        try { addBackup(state.fileName, await (await state.fileHandle.getFile()).text()); } catch { /* ignore */ }
        const w = await state.fileHandle.createWritable();
        await w.write(text);
        await w.close();
        state.savedText = text;
        saveDraft();
        render();
        ui.toast("Saved. Follow the Help steps to load it into the keyboard.", 6000);
      } catch (e) {
        ui.toast(`Couldn't save: ${e.message}. Use Copy and paste into the file instead.`, 7000);
      }
      return;
    }
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({
          id: "smartset", suggestedName: state.fileName,
          types: [{ description: "Layout file", accept: { "text/plain": [".txt"] } }],
        });
        state.fileHandle = h;
        state.fileName = h.name;
        return save();
      } catch (e) {
        if (e.name !== "AbortError") ui.toast(`Couldn't save: ${e.message}`);
        return;
      }
    }
    ui.download(text, state.fileName);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.file.toString());
      ui.toast(`Copied. Paste it over the contents of ${state.fileName} on the v-Drive.`, 5000);
    } catch {
      $("#ss-source").select();
      ui.toast("Select the text below and copy it.");
    }
  }

  function helpHTML() {
    const steps = m().helpSteps.map((s) => `<li>${s}</li>`).join("");
    return `<h2>Editing your ${m().name}</h2><ol>${steps}</ol>
      <p><b>Browsers:</b> saving straight to the drive needs Chrome, Edge or another Chromium browser. In Safari and Firefox, use <b>Open File…</b>, then <b>Copy</b> and paste the text into the file on the v-Drive.</p>
      <p>Your file is backed up in this browser whenever you open or save it:</p>`;
  }

  function fillBackups(ul) {
    ul.textContent = "";
    const list = backups().filter((b) => (b.model || "adv2") === m().id);
    if (!list.length) ul.innerHTML = `<li class="muted">No backups yet.</li>`;
    list.forEach((b) => {
      const li = document.createElement("li");
      li.innerHTML = `<span></span> <button class="link">Download</button> <button class="link">Load</button>`;
      li.firstChild.textContent = `${b.name} · ${new Date(b.time).toLocaleString()}`;
      const [, dl, load] = li.children;
      dl.onclick = () => ui.download(b.text, b.name.replace(/\.txt$/i, "") + "-backup.txt");
      load.onclick = () => {
        replaceText(b.text);
        ui.closeHelp();
        render();
        ui.toast(`Loaded the backup into the editor. Save to write it to ${state.fileName}.`, 5000);
      };
      ul.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // Events

  function bind() {
    $("#ss-open-file").onclick = async () => {
      if (!confirmDiscard()) return;
      root.App.openFile();
    };
    $("#ss-open-drive").onclick = () => { if (confirmDiscard()) root.App.openDrive(); };
    $("#ss-file-select").onchange = async (e) => {
      const f = state.dirFiles.find((x) => x.name === e.target.value);
      if (!f || !confirmDiscard()) return render();
      await openHandle(f.handle, f.name);
    };
    $("#ss-save").onclick = save;
    $("#ss-copy").onclick = copy;
    $("#ss-download").onclick = () => ui.download(state.file.toString(), state.fileName);
    $("#ss-undo").onclick = undo;
    $("#ss-redo").onclick = redo;

    $$("[data-ss-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.ssTab; renderInspector(); }));
    $("#ss-deselect").onclick = () => { state.selected = null; state.capturing = false; render(); };
    $("#ss-picker-search").oninput = (e) => { state.search = e.target.value; renderInspector(); };
    $("#ss-capture").onclick = () => { state.capturing = !state.capturing; renderInspector(); };
    $("#ss-disable").onclick = () => assign(m().nullToken);
    $("#ss-reset").onclick = () => {
      const loc = selectedLoc();
      if (loc) edit((f) => f.reset(state.layer, loc), `${keyName(loc)} is back to normal`);
    };

    $("#ss-th-apply").onclick = () => {
      const delay = parseInt($("#ss-th-delay").value, 10);
      if (!(delay >= 1 && delay <= 999)) return ui.toast("The hold delay must be between 1 and 999 ms.");
      const loc = selectedLoc();
      edit((f) => f.setTapHold(state.layer, loc, $("#ss-th-tap").value, $("#ss-th-hold").value, delay), "Tap & hold set");
    };
    $("#ss-th-clear").onclick = () => {
      const loc = selectedLoc();
      edit((f) => f.setAction(state.layer, loc, m().defaultAction(loc, state.layer)), "Tap & hold removed");
    };

    $("#ss-macro-text").oninput = (e) => {
      const tokens = m().textToMacro(e.target.value);
      if (tokens) $("#ss-macro-tokens").value = tokens.map((t) => `{${t}}`).join("");
      e.target.classList.toggle("invalid", !tokens);
    };
    $("#ss-macro-tokens").oninput = (e) => {
      const body = (e.target.value.match(/\{[^{}]*\}/g) || []).map((x) => x.slice(1, -1));
      $("#ss-macro-text").value = m().macroToText(body) ?? "";
    };
    const macroTrigger = () => [...$$("#ss-macro-mods input").filter((i) => i.checked).map((i) => i.value), selectedLoc()];
    $("#ss-macro-apply").onclick = () => {
      const raw = $("#ss-macro-tokens").value.trim();
      const body = (raw.match(/\{[^{}]*\}/g) || []).map((x) => x.slice(1, -1));
      if (!body.length) return ui.toast("Type some text or tokens for the macro first.");
      if (raw.replace(/\{[^{}]*\}/g, "").trim()) return ui.toast("Tokens must each be wrapped in { }.");
      const bad = body.filter((t) => !m().isMacroToken(t));
      if (bad.length) return ui.toast(`Unknown token${bad.length > 1 ? "s" : ""}: ${bad.map((t) => `{${t}}`).join(" ")}`, 5000);
      edit((f) => f.setMacro(state.layer, macroTrigger(), body), "Macro saved");
    };
    $("#ss-macro-clear").onclick = () => edit((f) => f.setMacro(state.layer, macroTrigger(), []), "Macro removed");

    let sourceTimer;
    $("#ss-source").oninput = (e) => {
      clearTimeout(sourceTimer);
      sourceTimer = setTimeout(() => {
        replaceText(e.target.value);
        renderBoard(); renderInspector(); renderSource(); renderChrome();
      }, 250);
    };
    $("#ss-source").onblur = () => renderSource();

    Board.interact($("#ss-board"), {
      onSelect: select,
      onSwap: (from, to) => {
        const [a, b] = [locs()[from], locs()[to]];
        if (m().isFixed(a) || m().isFixed(b)) return ui.toast("That key can't be moved.");
        edit((f) => f.swap(state.layer, a, b), `Swapped ${keyName(a)} and ${keyName(b)}`);
      },
    });
  }

  function select(pos) {
    const loc = locs()[pos];
    if (m().isFixed(loc)) return ui.toast(`The ${keyName(loc)} can't be reprogrammed.`);
    state.selected = pos;
    state.capturing = false;
    render();
  }

  /** Global key handling while this view is active. Returns true if the event was used. */
  function onKeyDown(e) {
    if (state.capturing) {
      e.preventDefault();
      const token = m().tokenForCode(e.code);
      state.capturing = false;
      if (token) assign(token);
      else { ui.toast(`The browser can't tell which key that was (${e.code || e.key}). Pick it from the list.`); renderInspector(); }
      return true;
    }
    const inField = e.target.closest?.("input, textarea, select, .testpad");
    const cmd = e.metaKey || e.ctrlKey;
    if (cmd && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return true; }
    if (inField) return false;
    if (cmd && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return true; }
    if (cmd && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return true; }
    if (e.key === "Escape" && state.selected != null) { state.selected = null; render(); return true; }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Public API used by main.js

  let bound = false;
  root.SmartSetEditor = {
    /** Switches to a model, restoring that model's last draft. */
    activate(model) {
      if (!bound) { bind(); bound = true; }
      if (state.model === model) return render();
      state.model = model;
      state.layer = model.layers[0].id;
      state.selected = null;
      state.dirFiles = [];
      state.fileHandle = null;
      state.history = [];
      state.future = [];
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(LS_DRAFT + model.id) || "null"); } catch { /* ignore */ }
      state.file = model.newFile(draft?.text || "");
      state.fileName = draft?.name || model.drive.defaultFileName;
      state.family = model.families ? draft?.family || model.familyForFilename(state.fileName) : null;
      state.savedText = draft?.savedText ?? "";
      render();
    },
    model: () => state.model,
    loadText,
    openFolder,
    confirmDiscard,
    isDirty,
    onKeyDown,
    helpHTML,
    fillBackups,
    /** Test pad hook: highlight keys producing these tokens. */
    pressToken(code, down) {
      if (!m()) return null;
      const token = m().tokenForCode(code);
      if (token) down ? state.pressed.add(token) : state.pressed.delete(token);
      renderBoard();
      return token ? m().describe(token, mac()).name : null;
    },
    clearPressed() { state.pressed.clear(); if (m()) renderBoard(); },
    rerender: render,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
