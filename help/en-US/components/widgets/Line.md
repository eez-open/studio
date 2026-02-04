# DESCRIPTION

The Line object is capable of drawing straight lines between a set of points.

[More info](https://docs.lvgl.io/master/widgets/line.html)

# PROPERTIES

## Points

List of points given as: `x1,y1 x2, y2 x3, y3 ...`, for example: `0,0 50,50 100,0 150,50 200,0`

## Invert Y

By default, the y == 0 point is in the top of the object. It might be counter-intuitive in some cases so the y coordinates can be inverted with this property. In this case, y == 0 will be the bottom of the object. y invert is disabled by default.

## Needle length

The length of the needle line in pixels. This property is only visible when the Line widget is used as a child of a Scale widget (scale needle mode).

## Value

The needle value on the scale. This property is only visible when the Line widget is used as a child of a Scale widget (scale needle mode).

## Value type

Select between `Literal` and `Expression`. If `Expression` is selected then `Value` can be evaluated from the expression. This property is only visible in scale needle mode.

## Preview value

This is optional property. If specified then the needle value of the Line in the project editor will be this value. Only available when `Value type` is set to `Expression`. This property is only visible in scale needle mode.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Scale_
