# DESCRIPTION

This Widget displays the default value through the `Data` property as a bar and as text (if selected). Also, if set, it will show two lines at the default positions (`Threshold1` and `Threshold2`), e.g. to mark some critical values.

# PROPERTIES

## Data

This is the value within the range `[Min, Max]` for which the bar and text will be rendered.

## Default style

Style used when rendering of the Widget.

## Orientation

Defines the orientation of the Widget, the following options are available:

- `Left right` – as the value set through `Data` increases from Min to Max, the bar inside the graph also increases from the left side to the right side.
- `Right left` – the bar grows from right to left
- `Top bottom` – the bar grows from top to bottom
- `Bottom top` – the bar grows from bottom to top

## Display value

When checked, `Data` value will also be displayed as text.

## Threshold1

An optional value within the range `[Min, Max]` at whose position a line will be drawn in the default style (`Threshold1`). It is used to mark some critical/important value within the bar graph.

## Threshold2

An optional value within the range `[Min, Max]` at whose position a line will be drawn in the default style (`Threshold2`). It is used to mark some critical/important value within the bar graph.

## Min

The minimum value that `Data` can contain.

## Max

The maximum value that `Data` can contain.

## Refresh rate

Similar to the case of the `DisplayData` Widget, it defines the speed at which the text will be refreshed.

## Text style

Style used to render the text inside the Widget.

## Threshold1 style

Style used to render the `Threshold1` value.

## Threshold2 style

Style used to render the `Threshold2` value.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _eez-gui-widgets-demo_
