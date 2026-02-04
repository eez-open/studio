# DESCRIPTION

Scale allows you to have a linear scale with ranges and sections with custom styling.

[More info](https://docs.lvgl.io/master/widgets/scale.html)

# PROPERTIES

## Scale mode

Defines position and orientation of the scale.

## Min value

The minimum value of the scale range.

## Min value type

Defines whether the `Min value` will be given as a Literal or as an Expression.

## Max value

The maximum value of the scale range.

## Max value type

Defines whether the `Max value` will be given as a Literal or as an Expression.

## Angle range

The angular span of the scale in degrees. For example, `270` means the scale spans 270 degrees.

## Rotation

An offset to the 0 degree position, in degrees.

## Rotation type

Defines whether the `Rotation` will be given as a Literal or as an Expression.

## Total tick count

Set the number of total ticks.

## Major tick every

Configure the major tick being every Nth ticks.

## Post draw

If enabled, the scale is drawn after the children are drawn. This can be useful when the scale has needles as children and the scale should be drawn on top of the needles.

## Draw ticks on top

If enabled, the ticks are drawn on top of the main line or arc.

## Show labels

Set to true if labels should be drawn.

## Label texts

Comma-separated list of custom label texts to use instead of the auto-generated numeric labels.

## Main styles

Section header for the main line/arc style properties.

## Main line width

The width of the main line in pixels. Only visible for straight scale modes (`HORIZONTAL_TOP`, `HORIZONTAL_BOTTOM`, `VERTICAL_LEFT`, `VERTICAL_RIGHT`).

## Main line color

The color of the main line. Only visible for straight scale modes.

## Main line opacity

The opacity of the main line (0-255). Only visible for straight scale modes.

## Main arc width

The width of the main arc in pixels. Only visible for round scale modes (`ROUND_INNER`, `ROUND_OUTER`).

## Main arc color

The color of the main arc. Only visible for round scale modes.

## Main arc opacity

The opacity of the main arc (0-255). Only visible for round scale modes.

## Main arc rounded

If enabled, the ends of the main arc are rounded. Only visible for round scale modes.

## Main arc image

A bitmap to use as the main arc image source. Only visible for round scale modes.

## Minor ticks styles

Section header for the minor ticks style properties.

## Minor ticks length

The length of the minor ticks in pixels.

## Minor ticks width

The width of the minor ticks in pixels.

## Minor ticks color

The color of the minor ticks.

## Minor ticks opacity

The opacity of the minor ticks (0-255).

## Major ticks styles

Section header for the major ticks style properties.

## Major ticks length

The length of the major ticks in pixels.

## Major ticks width

The width of the major ticks in pixels.

## Major ticks color

The color of the major ticks.

## Major ticks opacity

The opacity of the major ticks (0-255).

## Labels styles

Section header for the labels style properties.

## Labels text color

The color of the label texts.

## Labels text opacity

The opacity of the label texts (0-255).

## Labels text font

The font used for the label texts. Can be a built-in LVGL font or a custom font defined in the project.

## Sections

A list of scale sections. Each section defines a range of the scale with custom styling. Sections can have their own min/max values, and custom styles for the main line/arc, minor ticks, major ticks, and labels within that range. A style created for the Scale widget can also be assigned to a section via the `Use style` property.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Scale_