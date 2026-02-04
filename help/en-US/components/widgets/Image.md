# DESCRIPTION

This Widget displays an image.

[More info](https://docs.lvgl.io/8.3/widgets/core/img.html)

# PROPERTIES

## Image

The name of the bitmap to be displayed.

## Change pivot point (default is center)

If enabled then specify the image pivot point X and Y coordinate.

## Pivot X

X position of the center of rotation. If left blank, the center of rotation is in the middle of the Widget.

## Pivot Y

Y position of the center of rotation. If left blank, the center of rotation is in the middle of the Widget.

## Scale

Scale factor. Set factor to `256` to disable zooming. A larger value enlarges the images (e.g. `512` double size), a smaller value shrinks it (e.g. `128` half size). Fractional scale works as well, e.g. `281` for 10% enlargement.

## Rotation

Rotation angle, angle has 0.1 degree precision, so for 45.8° set `458`. Image is rotated around the centar of rotation which is defined with `Pivot X` and `Pivot Y` properties.

## Inner align

By default the image widget's width and height will be sized automatically according to the image source. If the widget's width or height is set the larger value the thisinner_align property tells how to align the image source inside the widget.

## Value

The needle value on the scale. This property is only visible when the Image widget is used as a child of a Scale widget (scale needle mode).

## Value type

Select between `Literal` and `Expression`. If `Expression` is selected then `Value` can be evaluated from the expression. This property is only visible in scale needle mode.

## Preview value

This is optional property. If specified then the needle value of the Image in the project editor will be this value. Only available when `Value type` is set to `Expression`. This property is only visible in scale needle mode.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _LVGL Widgets Demo_
