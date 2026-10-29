<p align="center"><img src="assets/wordmark-dark.png" width="420" alt="Remap360"></p>

<p align="center"><b>A visual keymap editor for the Kinesis Advantage360 Pro, made for the Mac.</b><br>
Plug in, click a key, change it, and it's live on your keyboard instantly.<br>
<b>New:</b> a <a href="#remap360-in-the-browser">browser version</a> for the Advantage360 Pro, Advantage360 and Advantage2.</p>

<p align="center"><img src="docs/screenshots/demo.gif" alt="Changing Esc to Mission Control live on the keyboard, then reverting" width="900"></p>

## Features

- **Live editing over USB.** Changes are on the keyboard the moment you make them. Try them, then **Keep Changes** or **Revert**.
- **Your keyboard language on the keycaps.** Legends follow the Mac's keyboard layout (English, German, French, Nordic, Icelandic…), including the Shift and Option characters in the corners.
- **Mac shortcuts built in.** Mission Control, Spotlight, Show Desktop, Screenshot, Lock Screen, Emoji and more, plus volume, brightness and media keys.
- **One-click presets.** Add a MacBook-style top row (brightness, Mission Control, media, volume) to your Fn layer.
- **Test Pad.** Press keys and see exactly what your Mac receives, and which key on which layer sent it.
- **Backups.** Every time you keep changes, your layout is backed up automatically. Export and import layouts as files.
- **Firmware update notice.** Tells you when Kinesis publishes new firmware.
- Layers: add, rename, reorder, duplicate. Drag keys to swap them. Copy and paste keys. Full undo.

<p align="center"><img src="docs/screenshots/editor.png" alt="Remap360 editing the Base layer" width="900"></p>

<p align="center"><img src="docs/screenshots/mac-row.png" alt="The Mac row preset on the Fn layer" width="900"></p>

## Requirements

- macOS 15 or newer
- Kinesis Advantage360 **Pro** with firmware that supports live editing (Kinesis calls it "Clique" firmware). Older keyboards need [Kinesis' one-time firmware update](https://kinesis-ergo.com/360p-clique-upgrade/).
- A USB data cable for editing. Your saved layout works over Bluetooth as usual.

## Install

**[Download Remap360.dmg](https://github.com/daffy-dev/remap360/releases/latest/download/Remap360.dmg)**, open it and drag Remap360 into Applications. It's signed and notarized, and runs on Apple Silicon and Intel.

Or build it yourself:

```sh
git clone https://github.com/daffy-dev/remap360.git
cd remap360
scripts/bundle.sh --install   # builds Remap360.app and copies it to /Applications
```

Maintainers: `scripts/release.sh` builds a signed, notarized, universal DMG in `build/release/`.

Building needs Xcode 16 or newer.

## How to use it

1. Open Remap360 and connect the **left half** of the keyboard with USB.
2. The first time, unlock editing on the keyboard: **hold Mod and press Esc** (on the stock layout). Remap360 shows you which keys.
3. Click a key, choose what it should do, and type to try it.
4. Click **Keep Changes** to store it on the keyboard. It stays there through restarts and works over Bluetooth, without Remap360 running.

## Remap360 in the browser

The `web/` folder holds a browser version of Remap360 that works with three Kinesis keyboards, with nothing to install. Pick your keyboard from the menu at the top, or connect it and let the page recognize it:

| Keyboard | How it's detected | How editing works |
| --- | --- | --- |
| **Advantage360 Pro** (ZMK) | Answers ZMK Studio over USB (Web Serial). Keyboards you've allowed before reconnect by themselves. | Live, like the Mac app: changes are on the keyboard immediately, then **Keep Changes** or **Revert**. Layers can be added, renamed and removed. |
| **Advantage360** (SmartSet, wired) | The `ADV360` v-Drive has a `layouts` folder (`layout1.txt`–`layout9.txt`). | Edits the profile's layout file: Base, Keypad, Fn, Fn2 and Fn3 layers. |
| **Advantage2** | The `ADVANTAGE2` v-Drive has an `active` folder (`qwerty.txt`, `dvorak.txt`). | Edits the layout file: Top and Keypad layers, QWERTY or Dvorak. |

Common to all three:
- Click a key to change it, or drag one key onto another to swap them. **Press a key…** picks the key by pressing it.
- Mac or Windows legends, and a Test Pad that highlights the key you press.

The Advantage360 and Advantage2 editors also have:
- Tap & hold actions, text macros (including modifier-combo triggers), disabling keys, and presets.
- The raw layout file side by side, with line-by-line error checking. Lines the editor doesn't understand are kept as they are.
- Undo/redo, and a backup in the browser every time a file is opened or saved.

**Browsers:** connecting an Advantage360 Pro, and saving straight to a v-Drive, need Chrome, Edge or another Chromium browser. In Safari and Firefox you can still open a layout file, then copy or download the result. There's a demo Advantage360 Pro (`?demo=adv360pro`) for trying the live editor without a keyboard.

**Use it:** open `web/index.html`, or the GitHub Pages copy once deployed (`.github/workflows/pages.yml` tests and publishes `web/` on every push to `main`). The Help button explains how to open the v-Drive or unlock the keyboard for each model.

Development: it's plain HTML/CSS/JS with no build step. Run the tests with `node --test web/test`. They cover the Studio protocol (matching the Swift tests), a simulated Advantage360 Pro, and both SmartSet file formats.

## FAQ

**How is this different from Kinesis Clique?**
Clique is Kinesis' official web editor and uses the same live-editing mechanism. Remap360 is a native Mac app that works without a Chrome-based browser, shows your own keyboard language on the keycaps, and adds Mac shortcut presets, the Test Pad and automatic backups. Changes made in one show up in the other.

**Does it change my keyboard's firmware?**
No. Live editing saves your layout as settings on the keyboard. Firmware tools exist but are experimental and hidden (Keyboard menu → Experimental Firmware Tools, needs Docker).

**Where are my backups?**
File → Show Layout Backups (`~/Library/Application Support/Remap360/Layout Backups`).

## Development

```sh
swift build
swift test
```

The core library (`Sources/Remap360Core`) holds the keymap parser, the ZMK Studio protocol and key code tables, and is covered by tests. The app (`Sources/Remap360`) is SwiftUI.

## Credits

- Built on [ZMK Firmware](https://zmk.dev) and its Studio RPC protocol.
- Layout data and the test fixture keymap come from Kinesis' MIT-licensed [Adv360-Pro-ZMK](https://github.com/KinesisCorporation/Adv360-Pro-ZMK) config.
- Advantage2 token names follow the [Advantage2 User's Manual](https://kinesis-ergo.com/support/advantage2/), cross-checked against the MIT-licensed [kijowski/kinesis](https://github.com/kijowski/kinesis) remap visualizer.
- Advantage360 (SmartSet) tokens follow Kinesis' [Direct Programming Guide](https://kinesis-ergo.com/wp-content/uploads/Advantage360-SmartSet-Direct-Programming-Guide-v2-11-22.pdf) and [action token list](https://kinesis-ergo.com/wp-content/uploads/Adv360-SmartSet-Direct-Programming-Action-Tokens-v3-31-23.pdf).

Remap360 is not affiliated with or endorsed by Kinesis Corporation. Advantage360 and Advantage2 are trademarks of Kinesis Corporation.

## License

[MIT](LICENSE)
