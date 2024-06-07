# DESCRIPTION

The Arc consists of a background and a foreground arc. The foreground (indicator) can be touch-adjusted.

[More info](https://docs.lvgl.io/8.3/widgets/core/arc.html)

# PROPERTIES

## Range min

The minimum value that can be selected by the `Value` property.

## Range min type

Defines whether the `Range min` will be given as a Literal or as an Expression.

## Range max

The maximum value that can be selected by the `Value` property.

## Range max type

Defines whether the `Range max` will be given as a Literal or as an Expression.

## Value

The value, in the range given by `Range min` and `Range max`, which sets the size of foreground (indicator) arc relative to the background arc.

## Value type

Defines whether the `Value` will be given as a Literal or as an Expression.

## Bg start angle

Start angle of the background arc. Zero degrees is at the middle right (3 o'clock) of the object and the degrees are increasing in clockwise direction. The angles should be in the `[0, 360]` range.

## Bg end angle

End angle of the background arc. Zero degrees is at the middle right (3 o'clock) of the object and the degrees are increasing in clockwise direction. The angles should be in the `[0, 360]` range.

## Mode

The arc can be one of the following modes:

-   `NORMAL` – The indicator arc is drawn from the minimum value to the current.
-   `REVERSE` – The indicator arc is drawn counter-clockwise from the maximum value to the current.
-   `SYMMETRICAL` – The indicator arc is drawn from the middle point to the current value.

## Rotation

An offset to the 0 degree position.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _LVGL Widgets Demo_
-   _Smart Home_
