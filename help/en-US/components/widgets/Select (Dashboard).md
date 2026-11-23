# DESCRIPTION

This Widget, similar to `Container`, has multiple Child widgets under it. But unlike `Container`, which will always display all Child widgets, this Widget displays only one Child widget, and that is the one we selected via the `Data` property. Therefore, use this Widget when you want depending on e.g. the value of some variable to change the structure of the page. Widgets are added to `Select` via the _Widgets Structure_ panel using drag and drop.

# PROPERTIES

## Data

The result of the evaluation of this expression must be the zero based index of the Widget that is to be displayed. So if the result is 0 then the first Widget will be displayed, if the result is 1 then the second Widget will be displayed, etc. The order of Widgets can be selected using drag and drop within the _Widgets Structure_ panel.

## Default style

Style used when rendering the background of the Widget.

## Widgets [EMPTY]


# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _eez-gui-widgets-demo_
