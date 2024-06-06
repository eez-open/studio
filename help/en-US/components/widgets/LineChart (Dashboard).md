# DESCRIPTION

Displays a Line chart consisting of the following parts:

-   Title
-   X Axis
-   Y axis
-   A legend
-   Grid
-   One or more lines

![Alt text](../images/line_chart_dashboard.png)

At the beginning of the chart there is not a single point on the lines. In order to add a point, it is necessary to pass the data through `value` input. One point is added for each applied data on that input. The X and Y values of that point on all lines should then be calculated from the received data. For example the received data can be a structure that has an X value and a Y value for each line.

# PROPERTIES

## Data [EMPTY]


## Default style

Style used when rendering of the Widget.

## X value

Defines the value on the X-axis for the added point. It can be set to the current time with `Date.now()` or some other value, but care must be taken to increase the value with each newly added point.

## Lines

Defines one or more lines on the Y-axis. The following must be specified for each line:

-   `Label` – The name of the line that is displayed in the Legend.
-   `Color` – Color of the line.
-   `Value` – The value on the Y axis for the added point.

## Title

Name of the chart.

## Display mode bar

When the mode bar with buttons will be displayed in the top right corner of the chart, possible options are: `Hover`, `Always` and `Never`.

## Show legend

It should be set if we want to display the legend.

## Show grid

It should be set if we want to display the grid.

## Show zero lines

It should be set if we want to display zero lines.

## Show X axis

It should be set if we want to display the X-axis.

## X axis tick suffix

If specified, this string value will be appended to the x axis values. Use this to set the unit of X Axis values.

## X axis range option

Here we have two options:

-   `Floating` – X-axis range will be automatically selected based on the X value at all points.
-   `Fixed` – X-axis range is set via `X axis range from` and `X axis range to` items.

## X axis range from

If `Fixed` is selected for `X axis range option`, then the lower limit of the X-axis range is set with this item.

## X axis range to

If `Fixed` is selected for `X axis range option`, then the upper limit of the X-axis range is set with this item.

## Show Y axis

It should be set if we want to display the Y-axis.

## Y axis tick suffix

If specified, this string value will be appended to the Y axis values. Use this to set the unit of Y Axis values.

## Y axis range option

Here we have two options:

-   `Floating` – Y-axis range will be automatically selected based on the Y value at all points.
-   `Fixed` – Y-axis range is set via `Y axis range from` and `Y axis range to` items.

## Y axis range from

If `Fixed` is selected for `Y axis range option`, then the lower limit of the Y-axis range is set with this item.

## Y axis range to

If `Fixed` is selected for `Y axis range option`, then the upper limit of the Y-axis range is set with this item.

## Max points

The maximum number of points that will be displayed.

## Margin

Manually selected margin values between the Widget borders and the chart itself within the Widget. It is necessary to leave an empty space for Title (displayed above the chart, so the appropriate `Top` margin should be selected), X-axis (displayed below the chart, `Bottom` margin), Y-axis (displayed to the left of the chart, `Left` margin) and Legend (displayed to the right of the chart, `Right` margin).

## Marker

At this position, a vertical line will be displayed inside the chart using `Marker` style.

## Marker style

Style used to render the marker.

# INPUTS

## reset

If we want to erase all the points on the chart, it is necessary to send a signal to this input.

## value

The input to which the value of the point that we want to add to the chart is sent. When the maximum number of points, which is set through the `Max points` item, is reached, then the oldest added point will be deleted.

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Dashboard Widgets Demo_
