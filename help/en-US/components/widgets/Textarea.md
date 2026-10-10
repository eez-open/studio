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

Use the existing type selector to choose Literal - String, Translated Literal,
or Expression. Without Flow, Expression is shown as Variable, as for other
LVGL string properties. An expression updates the placeholder on each tick;
an empty string clears it. Translated Literal uses the existing `_()` translation
hook in generated C; the editor preview displays the source text.

## One line mode

If enable, the `Text` area is configured to be on a single line. In this mode the height is set automatically to show only one line, line break characters are ignored, and word wrap is disabled.

## Password mode

This enables password mode. By default, if the `•` (Bullet, U+2022) character exists in the font, the entered characters are converted to it after some time or when a new character is entered. If `•` does not exist in the font, `\*` will be used.

## Password bullet

Custom replacement text used in password mode. Leave empty to keep LVGL's default.
The configured font must contain the selected glyphs. This property is applied
before Password mode when the widget is created.

The Textarea group of LVGL Actions also provides Get Text, Set Text, Set One Line,
Set Password Mode, Set Password Bullet and Set Placeholder Text. Get Text stores
an independent copy of the actual text, including when password mode is enabled.
Set Text and Set Placeholder Text do not remove expression bindings: a bound
value can overwrite the action's value on a subsequent tick.

## Accepted characters

We can set a list of accepted characters with this property. Other characters will be ignored.

## Max text length

The maximum number of characters can be limited with this property.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _LVGL Widgets Demo_
