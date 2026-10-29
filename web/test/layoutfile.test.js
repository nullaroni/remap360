// Run with: node --test web/test
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../js/tokens.js");
const { LayoutFile, parseLine } = require("../js/layoutfile.js");

test("every layer has 86 positions with unique tokens", () => {
  for (const family of ["qwerty", "dvorak"]) {
    for (const layer of ["top", "keypad"]) {
      const locs = T.locations(family, layer);
      assert.equal(locs.length, 86);
      assert.equal(locs.length, T.GEOMETRY.length);
      assert.equal(new Set(locs).size, 86, `${family}/${layer} has duplicates`);
      assert.equal(locs.filter((l) => !T.NOT_PROGRAMMABLE.has(l)).length, 84);
    }
  }
});

test("keypad layer tokens follow the manual's examples", () => {
  const kp = T.locations("qwerty", "keypad");
  assert.ok(kp.includes("kp-a"));
  assert.ok(kp.includes("kp-escape"));
  assert.ok(kp.includes("vol-"));
  assert.ok(kp.includes("kp7"));
  assert.equal(T.defaultAction("kp-a"), "a");
  assert.equal(T.defaultAction("kp7"), "kp7");
});

test("parses the manual's syntax examples", () => {
  assert.deepEqual(parseLine("[q]>[a]"), { kind: "remap", loc: "q", action: "a" });
  assert.deepEqual(parseLine("[CAPS]>[LCTRL]"), { kind: "remap", loc: "caps", action: "lctrl" });
  assert.deepEqual(parseLine("[lshift]>[esc][t&h250][lshift]"), {
    kind: "taphold", loc: "lshift", tap: "esc", delay: 250, hold: "lshift",
  });
  assert.deepEqual(parseLine("{rctrl}{g}>{g}{o}"), { kind: "macro", trigger: ["rctrl", "g"], body: ["g", "o"] });
  assert.deepEqual(parseLine("{f12}>{1}{-Rshift}{=}{+Rshift}{2}{=}{3}").body, ["1", "-Rshift", "=", "+Rshift", "2", "=", "3"]);
  assert.equal(parseLine("*[q]>[a]").kind, "disabled");
  assert.equal(parseLine("").kind, "blank");
});

test("valid manual examples have no problems", () => {
  const f = new LayoutFile([
    "[q]>[a]", "[rwin]>[null]", "[kp-a]>[vol-]", "[lshift]>[esc][t&h250][lshift]",
    "{rctrl}{g}>{g}{o}", "{kp-escape}>{h}{e}{l}{l}{o}", "{vol-}>{pup}{d500}{home}",
    "{hyphen}>{f1}{d500}{d500}{mute}", "[enter]>[88]",
  ].join("\r\n"));
  assert.deepEqual(f.problems(), []);
});

test("round-trips text exactly, including unknown lines and CRLF", () => {
  const text = "[caps]>[lctrl]\r\n*[tab]>[caps]\r\nsome note\r\n{f12}>{-Rshift}{1}{+Rshift}\r\n";
  assert.equal(new LayoutFile(text).toString(), text);
  assert.equal(new LayoutFile("[q]>[a]").toString(), "[q]>[a]");
  assert.equal(new LayoutFile("").toString(), "");
});

test("editing keeps line order and removes default remaps", () => {
  const f = new LayoutFile("[caps]>[lctrl]\n[tab]>[escape]\n");
  f.setAction("caps", "escape");
  assert.equal(f.toString(), "[caps]>[escape]\n[tab]>[escape]\n");
  f.setAction("tab", "tab");
  assert.equal(f.toString(), "[caps]>[escape]\n");
  f.setAction("q", "a");
  assert.equal(f.toString(), "[caps]>[escape]\n[q]>[a]\n");
});

test("new files use CRLF line endings", () => {
  const f = new LayoutFile("");
  f.setAction("caps", "lctrl");
  f.setTapHold("lshift", "escape", "lshift", 250);
  assert.equal(f.toString(), "[caps]>[lctrl]\r\n[lshift]>[escape][t&h250][lshift]\r\n");
});

test("last line wins and duplicates collapse on edit", () => {
  const f = new LayoutFile("[caps]>[lctrl]\n[caps]>[escape]\n");
  assert.equal(f.actionFor("caps"), "escape");
  f.setAction("caps", "lalt");
  assert.equal(f.toString(), "[caps]>[lalt]\n");
});

test("swap exchanges remapped and default keys", () => {
  const f = new LayoutFile("[caps]>[lctrl]\n");
  f.swap("caps", "escape");
  assert.equal(f.actionFor("caps"), "escape");
  assert.equal(f.actionFor("escape"), "lctrl");
});

test("macros are set, replaced and removed by trigger", () => {
  const f = new LayoutFile("");
  f.setMacro(["rctrl", "g"], ["g", "o"]);
  f.setMacro(["g", "rctrl"], ["h", "i"]);
  assert.equal(f.toString(), "{rctrl}{g}>{h}{i}\r\n");
  f.setMacro(["rctrl", "g"], []);
  assert.equal(f.toString(), "");
});

test("reset clears remaps and macros on a key", () => {
  const f = new LayoutFile("[g]>[h]\n{rctrl}{g}>{g}{o}\n[caps]>[lctrl]\n");
  f.reset("g");
  assert.equal(f.toString(), "[caps]>[lctrl]\n");
});

test("text macros round-trip with shift handling", () => {
  const tokens = T.textToMacro("Hi Joy! 1+2=3");
  assert.deepEqual(tokens.slice(0, 4), ["-lshift", "h", "+lshift", "i"]);
  assert.equal(T.macroToText(tokens), "Hi Joy! 1+2=3");
  assert.equal(T.textToMacro("é"), null);
});

test("browser key codes map to action tokens", () => {
  assert.equal(T.tokenForCode("KeyQ"), "q");
  assert.equal(T.tokenForCode("Digit7"), "7");
  assert.equal(T.tokenForCode("BracketLeft"), "obrack");
  assert.equal(T.tokenForCode("MetaLeft"), "lwin");
  assert.equal(T.tokenForCode("Numpad4"), "kp4");
  assert.equal(T.tokenForCode("F13"), "f13");
});
