// Run with: node --test web/test
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/zmk/studio.js");
const HID = require("../js/zmk/hid.js");
const { LiveKeymap, legend } = require("../js/zmk/keymap.js");
const { SimulatedKeyboard } = require("../js/zmk/sim.js");

const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join(" ");

test("framing escapes and decodes across chunks", () => {
  const payload = [0x01, 0xab, 0x02, 0xac, 0xad, 0x03];
  const framed = S.frame(payload);
  assert.deepEqual([...framed], [0xab, 0x01, 0xac, 0xab, 0x02, 0xac, 0xac, 0xac, 0xad, 0x03, 0xad]);
  const d = new S.FrameDecoder();
  const mid = framed.length >> 1;
  assert.deepEqual(d.feed(framed.slice(0, mid)), []);
  assert.deepEqual(d.feed(framed.slice(mid)).map((f) => [...f]), [payload]);
});

test("request bytes match the protobuf wire format", () => {
  assert.equal(hex(S.encodeRequest(1, { type: "getDeviceInfo" })), "08 01 1a 02 08 01");
  // set_layer_binding { layer_id: 2, key_position: 5, binding { behavior_id: 1, param1: 0x70004, param2: 0 } }
  assert.equal(
    hex(S.encodeRequest(7, { type: "setBinding", layerID: 2, position: 5, binding: { behaviorID: 1, param1: 0x070004, param2: 0 } })),
    "08 07 2a 10 12 0e 08 02 10 05 1a 08 08 02 10 84 80 1c 18 00",
  );
});

test("set binding round-trips negative behavior ids like the Swift test", () => {
  const m = new S.ProtoMessage(S.encodeRequest(7, { type: "setBinding", layerID: 2, position: 15, binding: { behaviorID: -1, param1: 0x070004, param2: 0 } }));
  assert.equal(m.uint(1), 7);
  const req = m.message(5).message(2);
  assert.equal(req.uint(1), 2);
  assert.equal(req.int(2), 15);
  assert.equal(req.message(3).sint(1), -1);
  assert.equal(req.message(3).uint(2), 0x070004);
});

test("decodes keymap responses, notifications and errors", () => {
  const w = new S.ProtoWriter();
  w.message(1, (rr) => {
    rr.uint(1, 3);
    rr.message(5, (km) => km.message(1, (k) => {
      k.message(1, (l) => {
        l.uint(1, 0); l.string(2, "Base");
        l.message(3, (b) => { b.sint(1, 4); b.uint(2, 0x070004); });
        l.message(3, (b) => { b.sint(1, 9); b.uint(2, 1); });
      });
      k.message(1, (l) => { l.uint(1, 1); l.string(2, "Fn"); });
      k.uint(2, 4); k.uint(3, 20);
    }));
  });
  const r = S.decode(w.data());
  assert.equal(r.id, 3);
  assert.deepEqual(r.reply.keymap.layers.map((l) => l.name), ["Base", "Fn"]);
  assert.deepEqual(r.reply.keymap.layers[0].bindings[1], { behaviorID: 9, param1: 1, param2: 0 });
  assert.equal(r.reply.keymap.availableLayers, 4);

  const lock = new S.ProtoWriter();
  lock.message(2, (n) => n.message(2, (c) => c.uint(1, 1)));
  assert.deepEqual(S.decode(lock.data()), { type: "lockStateChanged", unlocked: true });

  const err = new S.ProtoWriter();
  err.message(1, (rr) => { rr.uint(1, 5); rr.message(2, (m) => m.uint(2, 1)); });
  const e = S.decode(err.data());
  assert.equal(e.reply.type, "error");
  assert.equal(e.reply.error.code, "locked");

  const packed = new S.ProtoWriter();
  packed.message(1, (rr) => { rr.uint(1, 1); rr.message(4, (b) => b.message(1, (list) => {
    const inner = new S.ProtoWriter();
    for (const v of [1, 2, 300]) inner.varint(v);
    list.raw(1, inner.bytes);
  })); });
  assert.deepEqual(S.decode(packed.data()).reply.ids, [1, 2, 300]);
});

test("HID usage round trip matches the Mac app", () => {
  assert.equal(HID.encode("A"), 0x00070004);
  assert.equal(HID.encode("LG(LS(A))"), 0x0a070004);
  assert.equal(HID.encode("EXCL"), 0x0207001e);
  assert.equal(HID.encode("C_VOL_UP"), 0x000c00e9);
  assert.equal(HID.encode("NUMBER_4"), 0x00070021);
  assert.equal(HID.decode(0x00070004), "A");
  assert.equal(HID.decode(0x0207001e), "EXCL");
  assert.equal(HID.decode(0x0a070004), "LS(LG(A))");
  assert.equal(HID.decode(0x000700e1), "LSHFT");
  assert.equal(HID.decode(0x00000004), "A");
  assert.equal(HID.label("LG(SPACE)"), "⌘␣");
  assert.equal(HID.macShortcut("LG(PRCNT)").name, "Screenshot & Recording");
});

test("talks to a simulated keyboard: unlock, load, edit, save, revert", async () => {
  const sim = new SimulatedKeyboard({ locked: true });
  const conn = sim.connect();
  const notes = [];
  conn.onNotification = (n) => notes.push(n);

  assert.equal((await conn.call({ type: "getDeviceInfo" })).name, "Adv360 Pro (demo)");
  assert.equal((await conn.call({ type: "getLockState" })).unlocked, false);
  await assert.rejects(conn.call({ type: "getKeymap" }), (e) => e.code === "locked");
  sim.unlock();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(notes.some((n) => n.type === "lockStateChanged" && n.unlocked));

  const { ids } = await conn.call({ type: "listBehaviors" });
  const behaviors = [];
  for (const id of ids) behaviors.push((await conn.call({ type: "behaviorDetails", id })).behavior);
  const { keymap } = await conn.call({ type: "getKeymap" });
  const km = new LiveKeymap(keymap, behaviors);
  assert.equal(km.layers.length, 4);
  assert.equal(km.layers[0].bindings.length, 76);
  assert.deepEqual(km.toBinding(km.layers[0].bindings[28]), { behavior: "kp", params: ["ESC"] });
  assert.deepEqual(km.toBinding(km.layers[0].bindings[6]), { behavior: "tog", params: ["1"] });
  assert.deepEqual(km.toBinding(km.layers[3].bindings[1]), { behavior: "bt", params: ["BT_SEL", "0"] });
  assert.equal(legend(km.toBinding(km.layers[0].bindings[6]), km).label, "Kp");
  assert.deepEqual(km.toBinding(km.layers[3].bindings[50]), { behavior: "Version", params: [] });
  assert.equal(legend({ behavior: "Version", params: [] }, km).style, "macro");

  const caps = km.toStudio({ behavior: "mt", params: ["LCTRL", "ESC"] });
  await conn.call({ type: "setBinding", layerID: km.layers[0].id, position: 28, binding: caps });
  assert.equal((await conn.call({ type: "checkUnsaved" })).value, true);
  await conn.call({ type: "discard" });
  assert.equal((await conn.call({ type: "checkUnsaved" })).value, false);

  await conn.call({ type: "setBinding", layerID: 0, position: 28, binding: km.toStudio({ behavior: "kp", params: ["LG(SPACE)"] }) });
  await conn.call({ type: "save" });
  const again = (await conn.call({ type: "getKeymap" })).keymap;
  assert.deepEqual(km.toBinding(again.layers[0].bindings[28]), { behavior: "kp", params: ["LG(SPACE)"] });

  const added = await conn.call({ type: "addLayer" });
  assert.equal(added.index, 4);
  await conn.call({ type: "setLayerName", id: added.layer.id, name: "Gaming" });
  await conn.call({ type: "removeLayer", index: 4 });
  assert.equal((await conn.call({ type: "getKeymap" })).keymap.layers.length, 4);
});
