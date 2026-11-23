# DESCRIPTION

It is used to group several Widgets, and it is used when we want to additionally organize a page that contains a large number of Widgets or if we want to perform some operation on several Widgets at once, e.g. hide using the `Visible` property of the Container. When the Widget is inside the Container, then its left and top coordinates are relative to the left and top of the Container, which means that when the Container is moved, all the Widgets inside it are also moved. Widgets are added to the Container via the _Widgets Structure_ panel using drag and drop.

With the `Row` or `Column` layout the Container places its Child widgets one after another, so the page doesn't have to be laid out by hand.

# PROPERTIES

## Default style

Style used when rendering the background of the Widget.

## Name

Optional name to display in the _Widgets Structure_ panel in the editor. If not set then `Container` is displayed.

## Widgets [EMPTY]


## Overlay [EMPTY]


## Shadow [EMPTY]


## Layout

Determines how Child widgets are positioned within this container:

-   `Static` – Child widgets are positioned within the Container using their left and top properties.
-   `Row` – Child widgets are positioned from left to right (or vice versa if RTL is selected in the `SetPageDirection` action) and in order according to the order set through the _Widgets Structure_ panel. So, if this option is selected, then the left and top properties of the Child widget are not used. If a Child widget is hidden, then it is skipped and its position is taken by the next visible Widget in the list.
-   `Column` – Child widgets are positioned from top to bottom and in order according to the order set through the _Widgets Structure_ panel. So, if this option is selected, then the left and top properties of the Child widget are not used. If a Child widget is hidden, then it is skipped and its position is taken by the next visible Widget from the list.

A row or column shows only its first 64 Child widgets.

## Gap

The distance in pixels between two Child widgets of a row or column.

## Dividers

If checked, a row or column draws a line of 1 pixel, in the border color of the `Default style`, between its visible Child widgets (e.g. to separate the items of a group of settings).

## Justify content

Where a row or column places its Child widgets in the direction of the layout (horizontally in a row, vertically in a column), when they don't fill the Container:

-   `Start` – at the start (left in a row, top in a column).
-   `Center` – in the center.
-   `End` – at the end (right in a row, bottom in a column).
-   `Space between` – the first one at the start, the last one at the end and the free space equally between them.

## Align items

Where a row or column places its Child widgets in the other direction (vertically in a row, horizontally in a column). A Child widget can change it for itself with its `Align self` property:

-   `Start` – at the top in a row, at the left in a column.
-   `Center` – in the center.
-   `End` – at the bottom in a row, at the right in a column.
-   `Stretch` – the Child widgets get the height of the row or the width of the column.
-   `Baseline` – in a row, the Child widgets are placed so that the baselines of their texts are in line.

## Fit to content

For a row or column that is itself a Child widget of a row or column: its size is set by its Child widgets.

-   `None` – the size is set by the `Width` and `Height` properties.
-   `Width` – the width is set by the Child widgets.
-   `Height` – the height is set by the Child widgets.
-   `Both` – the width and the height are set by the Child widgets.

## Scroll

-   `None` – the Container doesn't scroll.
-   `Vertical` – the Child widgets below the bottom of the Container can be scrolled into view by dragging it with a touch. The Container shows a scroll indicator, like the `List` Widget. The Container that is an overlay doesn't scroll.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _eez-gui-widgets-demo_
