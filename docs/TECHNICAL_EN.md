# Technical notes

## Version

Current documented version: `1.1.3`.

## Target

The extension is designed for:

```text
https://cor3.gg/*
```

## Manifest

The extension uses Chrome Manifest V3.

Important manifest parts:

- `manifest_version: 3`
- `content_scripts` for `https://cor3.gg/*`
- `action.default_popup` for the ON/OFF popup
- `storage` permission for saving enabled/disabled state

## Main logic

The main script is `content.js`.

It:

1. listens to mouse movement;
2. checks whether the extension is enabled;
3. detects the exact top element under the cursor;
4. reads only direct rendered text nodes from that element;
5. ignores empty areas inside large cards or panels;
6. ignores text hidden behind upper modals or windows;
7. sends the detected English text to Google Translate;
8. shows the Russian translation in a tooltip.

## Exact text targeting

The extension intentionally avoids scanning parent containers. This is important because many `cor3.gg` UI blocks are large cards or panels that contain multiple nested text elements.

The goal is:

- cursor over actual text: translate;
- cursor over empty card space: do not translate;
- cursor over a modal/window: do not translate text behind it.

## Long text behavior

Configuration:

```js
maxTextLength: 12000
translateChunkSize: 1400
longTextThreshold: 1200
```

Behavior:

- text up to `12000` characters can be processed;
- long text is split into chunks before translation;
- if source text length is greater than `1200`, the tooltip switches to long mode:
  - close button appears;
  - internal scroll is enabled;
  - the tooltip can be hovered without disappearing.

## Short text behavior

For source text up to `1200` characters:

- compact tooltip;
- no close button;
- no internal scroll;
- non-interactive tooltip.

## Translation service

The extension uses:

```text
https://translate.googleapis.com/translate_a/single?client=gtx
```

No API key is included.

## ON/OFF popup

Files:

```text
popup.html
popup.js
popup.css
```

The state is stored in Chrome local storage under:

```text
cor3TranslatorEnabled
```

## Privacy note

The extension does not collect credentials, cookies, or files. However, text selected for translation is sent to Google Translate.

## Repository layout

Extension runtime files are stored in:

```text
extension/
```

When installing the extension manually through `chrome://extensions/`, select the `extension/` folder, not the repository root.
