# DESCRIPTION

This Widget allows us to select one option from a list using touch based scrolling.

# PROPERTIES

## Data

The variable in which the selected value in the range of `[Min, Max]` is saved.

## Default style

Style used when rendering the background of the Widget.

## Min

The minimum value that can be selected.

## Max

The maximum value that can be selected.

## Text

The text that is displayed in the widget for each possible value that is selected.

Example: set Data to `selected_option` (of type `integer`), set Min to `0`, and Max to `Array.length(TEXTS) - 1`, where `TEXTS` is a variable of type `array:string` with ` Default value` set to: `["Option 1", "Option 2", "Option 3", ...]` and then we can set this property to `TEXTS[selected_option]`.

## Selected value style

Style used to render selected value.

## Unselected value style

Style used to render other (unselected) values.

# INPUTS

## clear

We need to send a signal to this input if we want to reset the selection, i.e. choose the first option.

# OUTPUTS [EMPTY]

# EXAMPLES

* _eez-gui-widgets-demo_
