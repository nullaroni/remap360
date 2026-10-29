// App shell: picks the keyboard model (detected or chosen), switches views,
// and hosts the shared help dialog, test pad and toasts.
(function (root) {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const LS_MODEL = "remap360.model";
  const LS_OS = "remap360.os";
  const isMacPlatform = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || "");

  let os = localStorage.getItem(LS_OS) || (isMacPlatform ? "mac" : "win");
  let current = "start"; // start | adv360pro | adv360 | adv2

  // ---------------------------------------------------------------------------
  // Small UI helpers shared by the editors

  const UI = {
    os: () => os,
    toast(msg, ms = 3200) {
      const el = $("#toast");
      el.textContent = msg;
      el.hidden = false;
      clearTimeout(UI.toast.timer);
      UI.toast.timer = setTimeout(() => (el.hidden = true), ms);
    },
    download(text, name) {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    setTitle(t) { document.title = `${t} — Remap360`; },
    pickButton(label, name, title, on, onclick) {
      const b = document.createElement("button");
      b.className = `pick${on ? " on" : ""}`;
      b.title = title;
      b.innerHTML = `<span class="pick-label"></span><span class="pick-name"></span>`;
      b.firstChild.textContent = label;
      b.lastChild.textContent = name;
      b.onclick = onclick;
      return b;
    },
    closeHelp() { $("#help").close(); },
  };
  root.UI = UI;

  const MODELS = () => ({ adv2: root.Adv2Model, adv360: root.Adv360SmartSet.model });

  // ---------------------------------------------------------------------------
  // Views

  function show(model) {
    current = model;
    $("#view-start").hidden = model !== "start";
    $("#view-zmk").hidden = model !== "adv360pro";
    $("#view-smartset").hidden = model !== "adv360" && model !== "adv2";
    $("#testpad-section").hidden = model === "start";
    $("#model-select").value = model === "start" ? "auto" : model;
    if (model === "adv360pro") root.ZmkEditor.activate();
    else if (model !== "start") root.SmartSetEditor.activate(MODELS()[model]);
    else UI.setTitle("Kinesis keyboard editor");
  }

  function leaveAllowed(next) {
    if (current === next) return true;
    if ((current === "adv360" || current === "adv2") && !root.SmartSetEditor.confirmDiscard()) return false;
    if (current === "adv360pro" && root.ZmkEditor.isConnected() && root.ZmkEditor.isDirty()
        && !confirm("The keyboard has changes you haven't kept. Switch anyway? (They stay on the keyboard until it restarts.)")) return false;
    return true;
  }

  function choose(model, { remember = true } = {}) {
    if (!leaveAllowed(model)) { $("#model-select").value = current === "start" ? "auto" : current; return false; }
    if (remember) localStorage.setItem(LS_MODEL, model === "start" ? "auto" : model);
    show(model);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Detection: Advantage360 Pro over Web Serial

  async function tryStudioPort(port, timeoutMs = 1500) {
    let conn;
    try {
      conn = await root.ZmkStudio.openSerial(port);
      const info = await conn.call({ type: "getDeviceInfo" }, timeoutMs);
      return { conn, name: info.name };
    } catch (e) {
      try { await conn?.close(); } catch { /* ignore */ }
      if (e.name === "InvalidStateError") throw new Error("That port is already in use, maybe by another tab or app (ZMK Studio, Clique, the Remap360 Mac app).");
      return null;
    }
  }

  async function connectPro() {
    if (!navigator.serial) {
      choose("adv360pro");
      UI.toast("This browser can't connect to USB serial devices. Use Chrome or Edge.", 5000);
      return;
    }
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch (e) {
      if (e.name !== "NotFoundError") UI.toast(e.message);
      return;
    }
    try {
      const found = await tryStudioPort(port, 2500);
      if (!found) {
        UI.toast("That device didn't answer like an Advantage360 Pro. It needs Kinesis' ZMK Studio (Clique) firmware.", 7000);
        return;
      }
      if (!choose("adv360pro")) { await found.conn.close(); return; }
      await root.ZmkEditor.attach(found.conn, { name: found.name });
    } catch (e) {
      UI.toast(e.message, 6000);
    }
  }

  /** Silently reconnects a Pro the user already allowed in this browser. */
  async function autoDetectPro() {
    if (!navigator.serial || root.ZmkEditor.isConnected()) return false;
    const pref = localStorage.getItem(LS_MODEL) || "auto";
    if (pref !== "auto" && pref !== "adv360pro") return false;
    for (const port of await navigator.serial.getPorts()) {
      let found = null;
      try { found = await tryStudioPort(port); } catch { /* busy */ }
      if (!found) continue;
      if (current !== "adv360pro" && !choose("adv360pro", { remember: false })) { await found.conn.close(); return false; }
      await root.ZmkEditor.attach(found.conn, { name: found.name });
      UI.toast(`Found ${found.name || "your Advantage360 Pro"}`);
      return true;
    }
    return false;
  }

  async function demoPro() {
    if (!choose("adv360pro")) return;
    const sim = new root.ZmkSim.SimulatedKeyboard({ locked: true });
    await root.ZmkEditor.attach(sim.connect(), { name: "Advantage360 Pro (demo)", sim });
  }

  // ---------------------------------------------------------------------------
  // Detection: SmartSet v-Drives and layout files

  async function listTxt(dir) {
    const files = [];
    for await (const [name, h] of dir.entries()) {
      if (h.kind === "file" && !name.startsWith(".") && /\.txt$/i.test(name)) files.push({ name, handle: h });
    }
    return files;
  }

  async function subdir(dir, name) {
    try { return await dir.getDirectoryHandle(name); } catch { return null; }
  }

  /** Works out which keyboard a picked folder belongs to. */
  async function detectDrive(dir) {
    const active = await subdir(dir, "active");
    const layouts = await subdir(dir, "layouts");
    if (active) return { model: "adv2", files: await listTxt(active) };
    if (layouts) return { model: "adv360", files: await listTxt(layouts) };
    const files = await listTxt(dir);
    const names = files.map((f) => f.name.toLowerCase());
    if (names.some((n) => /^layout\d\.txt$/.test(n))) return { model: "adv360", files };
    if (names.some((n) => n === "qwerty.txt" || n === "dvorak.txt" || /_(qwerty|dvorak)\.txt$/.test(n))) return { model: "adv2", files };
    return null;
  }

  async function openDrive() {
    if (!window.showDirectoryPicker) {
      UI.toast("This browser can't open folders. Use Chrome or Edge, or use Open File… and Copy.", 5000);
      return;
    }
    let dir;
    try {
      dir = await window.showDirectoryPicker({ id: "kinesis-vdrive", mode: "readwrite" });
    } catch (e) {
      if (e.name !== "AbortError") UI.toast(`Couldn't open the folder: ${e.message}`);
      return;
    }
    const found = await detectDrive(dir);
    if (!found) {
      UI.toast("That doesn't look like a v-Drive. Pick the ADV360 or ADVANTAGE2 drive (or its layouts / active folder).", 6000);
      return;
    }
    const model = MODELS()[found.model];
    const files = found.files.filter((f) => model.drive.isLayoutFile(f.name));
    if (!files.length) return UI.toast("No layout files on that drive.");
    if (!choose(found.model)) return;
    await root.SmartSetEditor.openFolder(files);
  }

  function modelForFile(name, text) {
    if (/^layout\d\.txt$/i.test(name) || /^\s*<\s*(base|keypad|function[123])\s*>/im.test(text)) return "adv360";
    if (/(^|_)(qwerty|dvorak)\.txt$/i.test(name)) return "adv2";
    return current === "adv360" || current === "adv2" ? current : "adv2";
  }

  async function openFile() {
    const load = async (text, name, handle) => {
      const model = modelForFile(name, text);
      if (!choose(model)) return;
      root.SmartSetEditor.loadText(text, name, handle);
    };
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({
          id: "kinesis-layout", types: [{ description: "Layout file", accept: { "text/plain": [".txt"] } }],
        });
        await load(await (await h.getFile()).text(), h.name, h);
      } catch (e) {
        if (e.name !== "AbortError") UI.toast(`Couldn't open the file: ${e.message}`);
      }
      return;
    }
    const input = Object.assign(document.createElement("input"), { type: "file", accept: ".txt,text/plain" });
    input.onchange = async () => {
      const f = input.files[0];
      if (f) await load(await f.text(), f.name, null);
    };
    input.click();
  }

  // ---------------------------------------------------------------------------
  // Help, legends, test pad, keyboard shortcuts

  function openHelp() {
    const body = $("#help-body");
    const list = $("#backup-list");
    list.hidden = true;
    if (current === "adv360pro") body.innerHTML = root.ZmkEditor.helpHTML();
    else if (current === "adv360" || current === "adv2") {
      body.innerHTML = root.SmartSetEditor.helpHTML();
      list.hidden = false;
      root.SmartSetEditor.fillBackups(list);
    } else {
      body.innerHTML = `<h2>Remap360 in the browser</h2>
        <p>Remap360 edits three Kinesis keyboards:</p>
        <ul>
          <li><b>Advantage360 Pro</b> (ZMK): live over USB with Web Serial, in Chrome or Edge.</li>
          <li><b>Advantage360</b> (SmartSet, wired): edits the layout files on its <b>ADV360</b> v-Drive.</li>
          <li><b>Advantage2</b>: edits the layout files on its <b>ADVANTAGE2</b> v-Drive.</li>
        </ul>
        <p>Use the menu at the top to pick your keyboard, or connect it and open its v-Drive to have it recognized.</p>`;
    }
    $("#help").showModal();
  }

  function editor() {
    if (current === "adv360pro") return root.ZmkEditor;
    if (current === "adv360" || current === "adv2") return root.SmartSetEditor;
    return null;
  }

  function bindTestPad() {
    const pad = $("#testpad");
    const log = [];
    pad.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") e.preventDefault();
      const name = editor()?.pressToken(e.code, true);
      log.unshift(`${name || "Unknown key"}  ·  code ${e.code || "?"}${e.key && e.key.length === 1 ? `  ·  “${e.key}”` : ""}`);
      log.length = Math.min(log.length, 6);
      pad.textContent = log.join("\n");
    });
    pad.addEventListener("keyup", (e) => editor()?.pressToken(e.code, false));
    pad.addEventListener("blur", () => editor()?.clearPressed());
  }

  function renderOS() {
    $$("[data-os]").forEach((b) => b.classList.toggle("on", b.dataset.os === os));
  }

  function start() {
    $("#model-select").onchange = (e) => {
      const v = e.target.value;
      choose(v === "auto" ? "start" : v);
      if (v === "auto") autoDetectPro();
    };
    $$("[data-connect]").forEach((b) => (b.onclick = connectPro));
    $$("[data-drive]").forEach((b) => (b.onclick = openDrive));
    $$("[data-demo]").forEach((b) => (b.onclick = () => (b.dataset.demo === "adv360pro" ? demoPro() : choose(b.dataset.demo))));
    $$("[data-os]").forEach((b) => (b.onclick = () => {
      os = b.dataset.os;
      localStorage.setItem(LS_OS, os);
      renderOS();
      if (current === "adv360" || current === "adv2") root.SmartSetEditor.rerender();
    }));
    $("#btn-help").onclick = openHelp;
    bindTestPad();
    renderOS();

    document.addEventListener("keydown", (e) => { editor()?.onKeyDown(e); }, true);
    document.addEventListener("keyup", (e) => { editor()?.onKeyUp?.(e); }, true);
    window.addEventListener("beforeunload", (e) => {
      if ((current === "adv360" || current === "adv2") && root.SmartSetEditor.isDirty()) { e.preventDefault(); e.returnValue = ""; }
    });

    if (navigator.serial) {
      navigator.serial.addEventListener("connect", () => setTimeout(autoDetectPro, 800));
    }

    const params = new URLSearchParams(location.search);
    const pref = params.get("model") || localStorage.getItem(LS_MODEL) || "auto";
    if (params.get("demo") === "adv360pro") return demoPro();
    show(["adv360pro", "adv360", "adv2"].includes(pref) ? pref : "start");
    autoDetectPro().then((found) => {
      if (!found && current === "start") {
        $("#detect-status").textContent = navigator.serial
          ? "No Advantage360 Pro found yet. Connect one, or pick your keyboard below."
          : "Pick your keyboard below. (Advantage360 Pro needs Chrome or Edge to connect.)";
      }
    });
  }

  root.App = { start, connectPro, demoPro, openDrive, openFile, choose, detectDrive, modelForFile };
})(typeof globalThis !== "undefined" ? globalThis : this);
