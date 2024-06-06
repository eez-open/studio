# DESCRIPTION

A Widget used to display text.

[More info](https://docs.lvgl.io/8.3/widgets/core/label.html)

# PROPERTIES

## Text

Text to be displayed.

## Text type

Here we can choose whether the `Text` property will be calculated from the Expression.

## Preview value

This is optional property. If specified then the content of the Label in the project editor will be this value not the expression entered in Text property.

## Long mode

If `content` is selected for `Width` and `Height` then this item has no effect because the size of the Widget will be automatically set to fit the entire text, but if the size of the Widget is set manually (`px` or `%`) then using of this item defines one of the following ways in which the text will be split if it does not fit within the limits of the Widget:

-   `WRAP` – Wrap too long lines. If the `Height` is set to `content` it will be expanded, otherwise the text will be clipped (Default).
-   `DOT` – Replaces the last 3 characters from bottom right corner of the label with dots.
-   `SCROLL` – If the text is wider than the label scroll it horizontally back and forth. If it's higher, scroll vertically. Only one direction is scrolled and horizontal scrolling has higher precedence.
-   `SCROLL_CIRCULAR` – If the text is wider than the label scroll it horizontally continuously. If it's higher, scroll vertically. Only one direction is scrolled and horizontal scrolling has higher precedence.
-   `CLIP` – Simply clip the parts of the text outside the label.

## Recolor

If this is enabled then, in the text, we can use commands to recolor parts of the text. For example: "Write a #ff0000 red# word".

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [EMPTY]
