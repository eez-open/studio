# DESCRIPTION

The drop-down list allows the user to select one value from a list.

[More info](https://docs.lvgl.io/8.3/widgets/core/dropdown.html)

# PROPERTIES

## Options

List of options.

## Options type

Select between `Literal` and `Expression`. If `Literal` is selected then `Options` are entered one option per line. If `Expression` is selected then options are evaluated from `Options` expression which must be of type `array:string`.

## Selected

The zero-based index of the selected option.

## Selected type

Select between `Literal` and `Assignable`. If `Assignable` is selected then `Options` can be variable in which the zero-based index of the selected option will be stored.

## Direction

The list can be created on any side. If the list would be vertically out of the screen, it will be aligned to the edge.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Dashboard Widgets Demo_
