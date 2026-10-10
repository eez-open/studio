# DESCRIPTION

The Button Matrix object is a lightweight way to display multiple buttons in rows and columns.

[More info](https://docs.lvgl.io/8.3/widgets/core/btnmatrix.html)

# PROPERTIES

## Buttons

List of buttons. Each button has the following properties:

-   New line: if enabled then this is not actual button, but it introduces line break in button matrix.
-   Text: Label of the button
-   Text type: Literal - String or Expression, using the existing type selector.
    For example, `LVGL.LV_SYMBOL_OK + " OK"` displays a symbol and text with Flow.
    Literal `LV_SYMBOL_OK` remains ordinary text, including in older projects.
    Without Flow, use the existing Variable selector and return the symbol text
    from the generated variable getter.
-   Width: The buttons' width can be set relative to the other button in the same row. E.g. in a line with two buttons: btnA, width = 1 and btnB, width = 2, btnA will have 33 % width and btnB will have 66 % width.
-   HIDDEN Makes a button hidden (hidden buttons still take up space in the layout, they are just not visible or clickable)
-   NO_REPEAT Disable repeating when the button is long pressed
-   DISABLED Makes a button disabled Like LV_STATE_DISABLED on normal objects
-   CHECKABLE Enable toggling of a button. I.e. LV_STATE_CHECHED will be added/removed as the button is clicked
-   CHECKED Make the button checked. It will use the LV_STATE_CHECHKED styles.
-   CLICK_TRIG Enabled: send LV_EVENT_VALUE_CHANGE on CLICK, Disabled: send LV_EVENT_VALUE_CHANGE on PRESS
-   POPOVER Show the button label in a popover when pressing this key
-   RECOLOR Enable recoloring of button texts with #. E.g. "It's #ff0000 red#"
-   CUSTOM_1 Custom free to use flag
-   CUSTOM_2 Custom free to use flag

Use New line for row boundaries. An expression result is a button label, not a
row separator. An empty evaluated label displays a blank button and does not
terminate the map. Width keeps the existing integer range of 1 through 7.

The ButtonMatrix group of LVGL Actions provides Set Map, Get Selected Button and Get Button Text.
Set Map uses this same Buttons editor, including all widths, row boundaries and
control flags. Text expressions are evaluated when the action executes. An empty
Buttons list clears the map. The runtime copies the map and text and releases
them when replaced or when the widget is deleted.

A successful Set Map replaces the complete map and detaches the original widget text bindings; later ticks do not restore the old expression values. Failed Set Map validation leaves the existing map and bindings unchanged. Get Selected Button returns an index excluding New
line entries, or 65535 when no button is selected.

Get Button Text uses Object, Button ID and Store result into, following the
existing action editors. Button ID accepts Literal - Integer or Expression.
IDs start at 0 and exclude New line entries. The string result is a snapshot of
the current label (including LVGL symbols); later text/map updates and widget
deletion do not change it. An invalid ID, 65535 (NONE), or an empty map returns
an empty string. An evaluated blank label created by Set Map returns its actual
single-space text. Like the other new actions, this requires the matching
framework and Studio runtime.

## One check

The "One check" feature can be enabled to allow only one button to be checked at a time.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [EMPTY]
