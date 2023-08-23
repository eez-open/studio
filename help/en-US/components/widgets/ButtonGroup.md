# DESCRIPTION

Shows a group of buttons. The total number of buttons and their labels are defined with `Button labels`. Only one of those buttons can be selected, which is defined by the `Selected button` item. If the button is selected, then `Selected` style is used, otherwise `Default` style is used when rendering an individual button.

# PROPERTIES

## Button labels

Specifies the labels of all buttons. The number of elements in this string array defines how many buttons will be displayed.

## Default style

Style is used to render a button that is not selected.

## Selected button

Determines which button is selected. It is a zero-based integer, which means that if its value is 0, the first button will be selected, if its value is 1, the second button will be selected, etc. If we want no button to be selected, we will use the value -1.

## Selected style

Style used to render the selected button.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _eez-gui-widgets-demo_
