# Changelog

## 1.1.3

- Close button and internal scroll now appear only for source text longer than 1200 characters.
- Short translations use a compact non-interactive tooltip.
- Long translations use an interactive scrollable tooltip.

## 1.1.2

- Made the translation tooltip interactive and scrollable.
- The tooltip no longer disappears when the cursor moves from the source text to the translation window.
- Added a close button to the tooltip.
- Improved viewport clamping so the tooltip stays inside the visible screen.

## 1.1.1

- Increased maximum source text length for long story/dialogue blocks.
- Added paragraph/sentence chunked translation for long text.
- Made the translation tooltip scrollable for long translations.
- Preserved paragraph breaks in the tooltip.

## 1.1.0

- Added ON/OFF popup toggle in the browser toolbar.
- Added `storage` permission to save the enabled/disabled state.
- Changed hover detection to the exact top element under the cursor only.
- Parent containers are no longer scanned for text.

## 1.0.3

- Switched to stricter text targeting.
- Reduced unwanted translation of parent containers and empty card areas.

## 1.0.2

- Translation triggers only when the cursor is over rendered text area.
- Empty areas inside large cards/divs should not trigger translation.

## 1.0.1

- Added protection against translating text hidden behind upper windows or modals.

## 1.0.0

- Initial public version.
