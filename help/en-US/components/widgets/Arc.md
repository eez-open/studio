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

## Preview value

This is optional property. If specified then the value of the Arc in the project editor will be this value. Only available when `Value type` is set to `Expression`.

## Mode

The arc can be one of the following modes:

-   `NORMAL` – The indicator arc is drawn from the minimum value to the current.
-   `REVERSE` – The indicator arc is drawn counter-clockwise from the maximum value to the current.
-   `SYMMETRICAL` – The indicator arc is drawn from the middle point to the current value.

## Bg start angle

Start angle of the background arc. Zero degrees is at the middle right (3 o'clock) of the object and the degrees are increasing in clockwise direction. The angles should be in the `[0, 360]` range.

## Bg start angle type

Defines whether the `Bg start angle` will be given as a Literal or as an Expression.

## Preview bg start angle

This is optional property. If specified then the background start angle of the Arc in the project editor will be this value. Only available when `Bg start angle type` is set to `Expression`.

## Bg end angle

End angle of the background arc. Zero degrees is at the middle right (3 o'clock) of the object and the degrees are increasing in clockwise direction. The angles should be in the `[0, 360]` range.

## Bg end angle type

Defines whether the `Bg end angle` will be given as a Literal or as an Expression.

## Preview bg end angle

This is optional property. If specified then the background end angle of the Arc in the project editor will be this value. Only available when `Bg end angle type` is set to `Expression`.

## Rotation

An offset to the 0 degree position.

## Rotation type

Defines whether the `Rotation` will be given as a Literal or as an Expression.

## Preview rotation

This is optional property. If specified then the rotation of the Arc in the project editor will be this value. Only available when `Rotation type` is set to `Expression`.

## Use start/end angle

When enabled, the arc is controlled directly by start and end angles instead of by a value within a range. The `Range min`, `Range max`, `Value`, and `Mode` properties are hidden, and the `Start angle` and `End angle` properties are shown instead.

## Show note about use angle

Displays a note with instructions on how to make the arc non-adjustable: set the opacity (in Miscellaneous style section) of the knob to 0 and make the arc non-clickable (uncheck "Clickable" flag). Only visible when `Use start/end angle` is enabled.

## Start angle

Start angle of the foreground (indicator) arc. Zero degrees is at the middle right (3 o'clock) of the object and the degrees are increasing in clockwise direction. The angles should be in the `[0, 360]` range. Only visible when `Use start/end angle` is enabled.

## Start angle type

Defines whether the `Start angle` will be given as a Literal or as an Expression.

## Preview start angle

This is optional property. If specified then the start angle of the Arc in the project editor will be this value. Only available when `Start angle type` is set to `Expression`.

## End angle

End angle of the foreground (indicator) arc. Zero degrees is at the middle right (3 o'clock) of the object and the degrees are increasing in clockwise direction. The angles should be in the `[0, 360]` range. Only visible when `Use start/end angle` is enabled.

## End angle type

Defines whether the `End angle` will be given as a Literal or as an Expression.

## Preview end angle

This is optional property. If specified then the end angle of the Arc in the project editor will be this value. Only available when `End angle type` is set to `Expression`.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Arc_
-   _LVGL Widgets Demo_
-   _Smart Home_
