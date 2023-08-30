# DESCRIPTION

The Text Area is a Widget with a Label and a cursor on it. Texts or characters can be added to it. Long lines are wrapped and when the text becomes long enough the Text area can be scrolled.

One line mode and password modes are supported.

[More info](https://docs.lvgl.io/8.3/widgets/core/textarea.html)

# PROPERTIES

## Text

Text to be displayed.

## Text type

Here we can choose that the `Text` item is calculated from the Expression.

## Placeholder

A placeholder text can be specified – which is displayed when the `Text` area is empty.

## One line mode

If enable, the `Text` area is configured to be on a single line. In this mode the height is set automatically to show only one line, line break characters are ignored, and word wrap is disabled.

## Password mode

This enables password mode. By default, if the `•` (Bullet, U+2022) character exists in the font, the entered characters are converted to it after some time or when a new character is entered. If `•` does not exist in the font, `\*` will be used.

## Accepted characters

We can set a list of accepted characters with this property. Other characters will be ignored.

## Max text length

The maximum number of characters can be limited with this property.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _LVGL Widgets Demo_
