// ZMK Studio RPC for the Advantage360 Pro: protobuf messages (zmk-studio-messages)
// inside SOF/ESC/EOF framing. A port of Sources/Remap360Core/{Protobuf,StudioProtocol}.swift.
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Protobuf wire format (just what Studio needs)

  class ProtoWriter {
    constructor() { this.bytes = []; }
    varint(v) {
      v = BigInt.asUintN(64, BigInt(v));
      while (v >= 0x80n) {
        this.bytes.push(Number(v & 0x7fn) | 0x80);
        v >>= 7n;
      }
      this.bytes.push(Number(v));
    }
    tag(field, wire) { this.varint((BigInt(field) << 3n) | BigInt(wire)); }
    uint(field, value) { this.tag(field, 0); this.varint(value >>> 0); }
    int(field, value) { this.tag(field, 0); this.varint(BigInt.asUintN(64, BigInt(value | 0))); }
    sint(field, value) { this.tag(field, 0); this.varint(((value << 1) ^ (value >> 31)) >>> 0); }
    bool(field, value) { this.tag(field, 0); this.varint(value ? 1 : 0); }
    raw(field, bytes) {
      this.tag(field, 2);
      this.varint(bytes.length);
      for (const b of bytes) this.bytes.push(b);
    }
    string(field, s) { this.raw(field, [...new TextEncoder().encode(s)]); }
    message(field, build) {
      const sub = new ProtoWriter();
      build(sub);
      this.raw(field, sub.bytes);
    }
    data() { return Uint8Array.from(this.bytes); }
  }

  class ProtoMessage {
    constructor(bytes) {
      this.fields = new Map();
      let i = 0;
      const readVarint = () => {
        let result = 0n, shift = 0n;
        for (;;) {
          if (i >= bytes.length) throw new Error("truncated");
          const b = bytes[i++];
          result |= BigInt(b & 0x7f) << shift;
          if (!(b & 0x80)) return result;
          shift += 7n;
          if (shift > 63n) throw new Error("truncated");
        }
      };
      while (i < bytes.length) {
        const key = readVarint();
        const field = Number(key >> 3n), wire = Number(key & 7n);
        let value;
        if (wire === 0) value = { varint: readVarint() };
        else if (wire === 2) {
          const len = Number(readVarint());
          if (i + len > bytes.length) throw new Error("truncated");
          value = { bytes: bytes.slice(i, i + len) };
          i += len;
        } else if (wire === 1 || wire === 5) {
          const n = wire === 1 ? 8 : 4;
          if (i + n > bytes.length) throw new Error("truncated");
          let v = 0n;
          for (let k = 0; k < n; k++) v |= BigInt(bytes[i + k]) << BigInt(8 * k);
          i += n;
          value = { fixed: v };
        } else throw new Error(`unsupported wire type ${wire}`);
        if (!this.fields.has(field)) this.fields.set(field, []);
        this.fields.get(field).push(value);
      }
    }
    has(f) { return this.fields.has(f); }
    get empty() { return this.fields.size === 0; }
    last(f) { const v = this.fields.get(f); return v ? v[v.length - 1] : null; }
    uint(f) { const v = this.last(f); return v && v.varint != null ? Number(BigInt.asUintN(32, v.varint)) : 0; }
    int(f) { const v = this.last(f); return v && v.varint != null ? Number(BigInt.asIntN(32, v.varint)) : 0; }
    sint(f) { const r = this.uint(f); return (r >>> 1) ^ -(r & 1); }
    bool(f) { return this.uint(f) !== 0; }
    string(f) { const v = this.last(f); return v && v.bytes ? new TextDecoder().decode(v.bytes) : ""; }
    message(f) { const v = this.last(f); return v && v.bytes ? new ProtoMessage(v.bytes) : null; }
    messages(f) { return (this.fields.get(f) || []).filter((v) => v.bytes).map((v) => new ProtoMessage(v.bytes)); }
    /** Repeated uint32, packed or not. */
    uints(f) {
      const out = [];
      for (const v of this.fields.get(f) || []) {
        if (v.varint != null) out.push(Number(BigInt.asUintN(32, v.varint)));
        else if (v.bytes) {
          const b = v.bytes;
          let i = 0;
          while (i < b.length) {
            let r = 0n, s = 0n;
            for (;;) {
              if (i >= b.length) throw new Error("truncated");
              const x = b[i++];
              r |= BigInt(x & 0x7f) << s;
              if (!(x & 0x80)) break;
              s += 7n;
            }
            out.push(Number(BigInt.asUintN(32, r)));
          }
        }
      }
      return out;
    }
  }

  // ---------------------------------------------------------------------------
  // Framing

  const SOF = 0xab, ESC = 0xac, EOF = 0xad;

  function frame(payload) {
    const out = [SOF];
    for (const b of payload) {
      if (b === SOF || b === ESC || b === EOF) out.push(ESC);
      out.push(b);
    }
    out.push(EOF);
    return Uint8Array.from(out);
  }

  class FrameDecoder {
    constructor() { this.state = "idle"; this.buf = []; }
    feed(bytes) {
      const frames = [];
      for (const b of bytes) {
        if (this.state === "idle") {
          if (b === SOF) { this.state = "data"; this.buf = []; }
        } else if (this.state === "data") {
          if (b === SOF) this.buf = [];
          else if (b === ESC) this.state = "escaped";
          else if (b === EOF) { frames.push(Uint8Array.from(this.buf)); this.buf = []; this.state = "idle"; } else this.buf.push(b);
        } else {
          this.buf.push(b);
          this.state = "data";
        }
      }
      return frames;
    }
  }

  // ---------------------------------------------------------------------------
  // Requests: { type, ...args } -> bytes

  function encodeRequest(id, req) {
    const w = new ProtoWriter();
    w.uint(1, id);
    switch (req.type) {
      case "getDeviceInfo": w.message(3, (c) => c.bool(1, true)); break;
      case "getLockState": w.message(3, (c) => c.bool(2, true)); break;
      case "lock": w.message(3, (c) => c.bool(3, true)); break;
      case "listBehaviors": w.message(4, (b) => b.bool(1, true)); break;
      case "behaviorDetails": w.message(4, (b) => b.message(2, (d) => d.uint(1, req.id >>> 0))); break;
      case "getKeymap": w.message(5, (k) => k.bool(1, true)); break;
      case "setBinding":
        w.message(5, (k) => k.message(2, (r) => {
          r.uint(1, req.layerID);
          r.int(2, req.position);
          r.message(3, (b) => {
            b.sint(1, req.binding.behaviorID);
            b.uint(2, req.binding.param1 >>> 0);
            b.uint(3, req.binding.param2 >>> 0);
          });
        }));
        break;
      case "checkUnsaved": w.message(5, (k) => k.bool(3, true)); break;
      case "save": w.message(5, (k) => k.bool(4, true)); break;
      case "discard": w.message(5, (k) => k.bool(5, true)); break;
      case "moveLayer": w.message(5, (k) => k.message(8, (x) => { x.uint(1, req.from); x.uint(2, req.to); })); break;
      case "addLayer": w.message(5, (k) => k.message(9, () => {})); break;
      case "removeLayer": w.message(5, (k) => k.message(10, (x) => x.uint(1, req.index))); break;
      case "restoreLayer": w.message(5, (k) => k.message(11, (x) => { x.uint(1, req.id); x.uint(2, req.at); })); break;
      case "setLayerName": w.message(5, (k) => k.message(12, (x) => { x.uint(1, req.id); x.string(2, req.name); })); break;
      default: throw new Error(`Unknown request ${req.type}`);
    }
    return w.data();
  }

  // ---------------------------------------------------------------------------
  // Responses and notifications

  class StudioError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }
  const err = (msg, code) => ({ type: "error", error: new StudioError(msg, code) });

  function parseLayer(m) {
    return {
      id: m.uint(1),
      name: m.string(2),
      bindings: m.messages(3).map((b) => ({ behaviorID: b.sint(1), param1: b.uint(2), param2: b.uint(3) })),
    };
  }

  function parseKeymap(m) {
    return { layers: m.messages(1).map(parseLayer), availableLayers: m.uint(2), maxLayerNameLength: m.uint(3) };
  }

  function paramValue(m) {
    let kind;
    if (m.has(3)) kind = { type: "constant", value: m.uint(3) };
    else if (m.message(4)) { const r = m.message(4); kind = { type: "range", min: r.int(1), max: r.int(2) }; }
    else if (m.message(5)) { const h = m.message(5); kind = { type: "hidUsage", keyboardMax: h.uint(1), consumerMax: h.uint(2) }; }
    else if (m.has(6)) kind = { type: "layerID" };
    else kind = { type: "nil" };
    return { name: m.string(1), kind };
  }

  function reply(rr) {
    const meta = rr.message(2);
    if (meta) {
      if (meta.has(2)) {
        const c = meta.uint(2);
        if (c === 1) return err("The keyboard is locked. Unlock it to make changes.", "locked");
        if (c === 2) return err("This keyboard's firmware doesn't support that request.");
        return err(`The keyboard reported an error (${c}).`);
      }
      return { type: "ok" };
    }
    const core = rr.message(3);
    if (core) {
      const info = core.message(1);
      if (info) return { type: "deviceInfo", name: info.string(1) };
      if (core.has(2) || core.empty) return { type: "lockState", unlocked: core.uint(2) === 1 };
      return { type: "ok" };
    }
    const beh = rr.message(4);
    if (beh) {
      const list = beh.message(1);
      if (list) return { type: "behaviorIDs", ids: list.uints(1).map((x) => x | 0) };
      const d = beh.message(2);
      if (d) {
        return {
          type: "behavior",
          behavior: {
            id: d.uint(1) | 0,
            displayName: d.string(2),
            metadata: d.messages(3).map((s) => ({ param1: s.messages(1).map(paramValue), param2: s.messages(2).map(paramValue) })),
          },
        };
      }
      return { type: "behaviorIDs", ids: [] };
    }
    const km = rr.message(5);
    if (km) {
      const keymap = km.message(1);
      if (keymap) return { type: "keymap", keymap: parseKeymap(keymap) };
      if (km.has(2)) {
        const c = km.uint(2);
        if (c === 0) return { type: "ok" };
        if (c === 1) return err("That key position doesn't exist.");
        if (c === 2) return err("The keyboard doesn't have that behavior.");
        return err("The keyboard rejected those settings for this key.");
      }
      if (km.has(3)) return { type: "bool", value: km.bool(3) };
      const save = km.message(4);
      if (save) {
        if (save.has(2)) return err(save.uint(2) === 3 ? "The keyboard is out of storage space." : "The keyboard couldn't save the changes.");
        return { type: "ok" };
      }
      if (km.has(5)) return { type: "ok" };
      const move = km.message(8);
      if (move) {
        const k = move.message(1);
        return k ? { type: "keymap", keymap: parseKeymap(k) } : err("Couldn't move that layer.");
      }
      const add = km.message(9);
      if (add) {
        const ok = add.message(1);
        if (ok && ok.message(2)) return { type: "addedLayer", index: ok.uint(1), layer: parseLayer(ok.message(2)) };
        return err(add.uint(2) === 2 ? "No free layer slots left on the keyboard." : "Couldn't add a layer.");
      }
      const remove = km.message(10);
      if (remove) return remove.has(2) ? err("Couldn't remove that layer.") : { type: "ok" };
      const restore = km.message(11);
      if (restore) {
        const l = restore.message(1);
        return l ? { type: "layer", layer: parseLayer(l) } : err("Couldn't restore that layer.");
      }
      if (km.has(12)) return km.uint(12) === 0 ? { type: "ok" } : err("Couldn't rename that layer.");
      return { type: "ok" };
    }
    return { type: "ok" };
  }

  function decode(bytes) {
    const msg = new ProtoMessage(bytes);
    const rr = msg.message(1);
    if (rr) return { type: "response", id: rr.uint(1), reply: reply(rr) };
    const n = msg.message(2);
    if (n) {
      const core = n.message(2);
      if (core && core.has(1)) return { type: "lockStateChanged", unlocked: core.uint(1) === 1 };
      const km = n.message(5);
      if (km && km.has(1)) return { type: "unsavedChanged", unsaved: km.bool(1) };
    }
    return { type: "unknown" };
  }

  // ---------------------------------------------------------------------------
  // Connection: request/response over any byte transport.
  // transport: { write(Uint8Array): Promise, close(): Promise } and calls conn.receive(bytes).

  class StudioConnection {
    constructor(transport) {
      this.transport = transport;
      this.decoder = new FrameDecoder();
      this.pending = new Map();
      this.nextID = 1;
      this.closed = false;
      this.onNotification = null;
      this.onClose = null;
    }

    receive(bytes) {
      for (const f of this.decoder.feed(bytes)) {
        let msg;
        try { msg = decode(f); } catch { continue; }
        if (msg.type === "response") {
          const p = this.pending.get(msg.id);
          if (!p) continue;
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.reply.type === "error") p.reject(msg.reply.error);
          else p.resolve(msg.reply);
        } else if (msg.type !== "unknown" && this.onNotification) {
          this.onNotification(msg);
        }
      }
    }

    didClose() {
      if (this.closed) return;
      this.closed = true;
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new StudioError("The keyboard was disconnected.", "closed")); }
      this.pending.clear();
      if (this.onClose) this.onClose();
    }

    call(req, timeoutMs = 4000) {
      if (this.closed) return Promise.reject(new StudioError("The keyboard was disconnected.", "closed"));
      const id = this.nextID++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new StudioError("The keyboard didn't answer.", "timeout"));
        }, timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        Promise.resolve(this.transport.write(frame(encodeRequest(id, req)))).catch((e) => {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(e);
        });
      });
    }

    close() { return this.transport.close(); }
  }

  /** Web Serial transport. */
  async function openSerial(port) {
    await port.open({ baudRate: 115200 });
    try { await port.setSignals({ dataTerminalReady: true, requestToSend: true }); } catch { /* optional */ }
    const writer = port.writable.getWriter();
    let reader = null, closing = false;
    const transport = {
      write: (bytes) => writer.write(bytes),
      async close() {
        closing = true;
        try { await reader?.cancel(); } catch { /* ignore */ }
        try { writer.releaseLock(); } catch { /* ignore */ }
        try { await port.close(); } catch { /* ignore */ }
        conn.didClose();
      },
    };
    const conn = new StudioConnection(transport);
    (async () => {
      try {
        while (port.readable && !closing) {
          reader = port.readable.getReader();
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) conn.receive(value);
            }
          } finally {
            reader.releaseLock();
          }
        }
      } catch { /* device gone */ }
      if (!closing) transport.close();
    })();
    return conn;
  }

  const api = { ProtoWriter, ProtoMessage, frame, FrameDecoder, encodeRequest, decode, StudioConnection, StudioError, openSerial };
  root.ZmkStudio = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
