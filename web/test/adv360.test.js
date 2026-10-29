// Run with: node --test web/test
const test = require("node:test");
const assert = require("node:assert/strict");
const { Adv360File, parseLine, POSITIONS, defaultAction, isActionToken, textToMacro, macroToText, model } = require("../js/smartset/adv360-model.js");

test("76 positions matching the Pro's keymap order, SmartSet key fixed", () => {
  assert.equal(POSITIONS.length, 76);
  assert.equal(new Set(POSITIONS).size, 76);
  assert.equal(POSITIONS[28], "esc");
  assert.ok(model.isFixed("ss"));
});

test("layer defaults follow the keycaps", () => {
  assert.equal(defaultAction("caps", "base"), "caps");
  assert.equal(defaultAction("kp", "base"), "keyt");
  assert.equal(defaultAction("u", "keypad"), "kp7");
  assert.equal(defaultAction("eql", "function1"), "f1");
  assert.equal(defaultAction("eql", "function2"), "eql");
});

test("parses the guide's examples", () => {
  assert.deepEqual(parseLine("[hk1]>[q]"), { kind: "remap", loc: "hk1", action: "q" });
  assert.deepEqual(parseLine("[caps]>[caps][t&h500][esc]"), { kind: "taphold", loc: "caps", tap: "caps", delay: 500, hold: "esc" });
  assert.deepEqual(parseLine("{pause}{rctrl}>{-lshf}{h}{+lshf}{i}").trigger, ["pause", "rctr"]);
  assert.equal(parseLine("<keypad>").layer, "keypad");
  const f = new Adv360File("<base>\n[esc]>[caps]\n{lctrl}{hk4}>{s9}{q}{w}{e}{r}{t}{y}\n{hk1}>{x3}{vol+}\n");
  assert.deepEqual(f.problems(), []);
  assert.ok(isActionToken("kh7f"));
});

test("edits land in the right layer section", () => {
  const f = new Adv360File("");
  f.setAction("base", "caps", "lctr");
  f.setAction("keypad", "j", "left");
  f.setAction("base", "esc", "grav");
  assert.equal(f.toString(), "<base>\r\n[caps]>[lctr]\r\n[esc]>[grav]\r\n<keypad>\r\n[j]>[left]\r\n");
  assert.equal(f.actionFor("keypad", "caps"), "caps");
  assert.equal(f.actionFor("base", "caps"), "lctr");
  f.setAction("keypad", "j", "kp4");
  assert.equal(f.toString(), "<base>\r\n[caps]>[lctr]\r\n[esc]>[grav]\r\n<keypad>\r\n");
  f.setMacro("base", ["rctr", "pause"], ["h", "i"]);
  assert.match(f.toString(), /\[esc\]>\[grav\]\r\n\{pause\}\{rctr\}>\{h\}\{i\}\r\n<keypad>/);
});

test("round-trips text exactly", () => {
  const text = "<base>\n[caps]>[esc]\n*[tab]>[caps]\n\n<function1>\n{hk1}>{x3}{vol+}\n";
  assert.equal(new Adv360File(text).toString(), text);
});

test("text macros use 360 tokens", () => {
  const t = textToMacro("Hi, you!");
  assert.deepEqual(t, ["-lshf", "h", "+lshf", "i", "comm", "spc", "y", "o", "u", "-lshf", "1", "+lshf"]);
  assert.equal(macroToText(t), "Hi, you!");
});
