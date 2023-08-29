# DESCRIPTION [DRAFT]

The bar object has a background and an indicator on it. The width of the indicator is set according to the current value of the bar.

Vertical bars can be created if the width of the object is smaller than its height.

Not only the end, but also the start value of the bar can be set, which changes the start position of the indicator.

[More info](https://docs.lvgl.io/8.3/widgets/core/bar.html)

# PROPERTIES

## Min [DRAFT]

The minimum value that `Value` and `Value start` can contain.

## Max [DRAFT]

The maximum value that `Value` and `Value start` can contain.

## Mode [DRAFT]

Bar mode options:

-   `NORMAL`: A normal bar.
-   `SYMMETRICAL`: Draw the indicator from the zero value to current value. Requires a negative minimum range and positive maximum range.
-   `RANGE`: Allows setting the start value (`Value start` property) and end value (`Value` property).

## Value [DRAFT]

The end value on the bar.

## Value type [DRAFT]

Select between `Literal` and `Expression`. If `Expression` is selected then `Value` can be evaluated from the expression.

## Value start [DRAFT]

The start value on the bar if `RANGE` mode is selected.

## Value start type [DRAFT]

Select between `Literal` and `Expression`. If `Expression` is selected then `Value start` can be evaluated from the expression.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Dashboard Widgets Demo_
