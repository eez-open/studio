# DESCRIPTION

The Button Matrix object is a lightweight way to display multiple buttons in rows and columns.

[More info](https://docs.lvgl.io/8.3/widgets/core/btnmatrix.html)

# PROPERTIES

## Buttons

List of buttons. Each button has the following properties:

-   New line: if enabled then this is not actual button, but it introduces line break in button matrix.
-   Text: Label of the button
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

## One check

The "One check" feature can be enabled to allow only one button to be checked at a time.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [EMPTY]
