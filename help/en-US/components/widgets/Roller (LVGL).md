# DESCRIPTION

This Widget allows us to select one option from a list using touch based scrolling.

[More info](https://docs.lvgl.io/8.3/widgets/core/roller.html)

# PROPERTIES

## Options

List of options.

## Options type

Select between `Literal` and `Expression`. If `Literal` is selected then `Options` are entered one option per line. If `Expression` is selected then options are evaluated from `Options` expression which must be of type `array:string`.

## Selected

The zero-based index of the selected option.

## Selected type

Select between `Literal` and `Assignable`. If `Assignable` is selected then `Options` can be variable in which the zero-based index of the selected option will be stored.

## Mode

Roller mode options:

-   `NORMAL` – normal roller.
-   `INFINITE` – makes the roller circular.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _LVGL Widgets Demo_
