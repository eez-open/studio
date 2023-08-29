# DESCRIPTION [DRAFT]

This Widget allows us to select one or two values from the list by moving the knob on the slider.

[More info](https://docs.lvgl.io/8.3/widgets/core/slider.html)

# PROPERTIES

## Min [DRAFT]

The minimum value that can be selected.

## Max [DRAFT]

The maximum value that can be selected.

## Mode [DRAFT]

Slider mode options:

-   `NORMAL`: A normal slider
-   `SYMMETRICAL`: Draw the indicator form the zero value to current value. Requires negative minimum range and positive maximum range.
-   `RANGE`: Allows setting the start value (`Value left` property) and end value (`Value` property).

## Value [DRAFT]

The selected value on the slider. If `RANGE` mode is selected then this is selected end value on the slider.

## Value type [DRAFT]

Select between `Literal` and `Assignable`. If `Assignable` is selected then `Value` can be variable in which the selected value will be stored.

## Value left [DRAFT]

If `RANGE` mode is selected then this is selected start value on the slider.

## Value left type [DRAFT]

Select between `Literal` and `Assignable`. If `Assignable` is selected then `Value left` can be variable in which the selected start value will be stored.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Dashboard Widgets Demo_
