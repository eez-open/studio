# DESCRIPTION

This Widget displays text spans with different styles. It allows combining multiple text segments (spans) with individual formatting for each.

[More info](https://docs.lvgl.io/master/widgets/spangroup.html)

# PROPERTIES

## Mode

Text wrapping and layout mode (LVGL 8.4.0 and 9.2.2 only):

- `FIXED` (default) – Text is laid out in a fixed manner without wrapping.
- `EXPAND` – Text expands to fill available space.
- `BREAK` – Text wraps to multiple lines.

## Overflow

How text overflowing the widget boundaries is handled:

- `CLIP` (default) – Overflowing text is clipped.
- `ELLIPSIS` – Overflowing text is replaced with ellipsis ("…").

## Indent

Indentation for text layout in pixels.

## Max lines

Maximum number of lines to display. Use `-1` to allow unlimited lines.

## Align

Text alignment within the widget (LVGL 8.4.0 and 9.2.2 only):

- `AUTO` (default) – Automatic alignment based on the language direction.
- `LEFT` – Left align text.
- `CENTER` – Center align text.
- `RIGHT` – Right align text.

## Spans

Array of text spans. Each span can have its own text content and individual styling (color, font, decoration, letter/line spacing, opacity).

# INPUTS

# OUTPUTS

# EXAMPLES [EMPTY]
