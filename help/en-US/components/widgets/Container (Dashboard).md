# DESCRIPTION

It is used to group several Widgets, and it is used when we want to additionally organize a page that contains a large number of Widgets or if we want to perform some operation on several Widgets at once, e.g. hide using the `Visible` property of the Container. When the Widget is inside the Container, then its left and top coordinates are relative to the left and top of the Container, which means that when the Container is moved, all the Widgets inside it are also moved. Widgets are added to the Container via the _Widgets Structure_ panel using drag and drop.

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
-   `Horizontal` – Child widgets are positioned from left to right (or vice versa if RTL is selected in the `SetPageDirection` action) and in order according to the order set through the _Widgets Structure_ panel. So, if this option is selected, then the left property of the Child widget is not used. If a Child widget is hidden, then it is skipped and its position is taken by the next visible Widget in the list.
-   `Vertical` – Child widgets are positioned from top to bottom and in order according to the order set through the _Widgets Structure_ panel. So, if this option is selected, then the top property of the Child widget is not used. If a Child widget is hidden, then it is skipped and its position is taken by the next visible Widget from the list.
-   `Docking Manager` – Each child widget is located inside separate tab and these tabs can be arranged within container boundaries in an arbitrary way. For example, they can be grouped inside tab strips or docked at any position inside container. This options is only available for Dashboard projects.

## Edit layout

If `Layout` property is set to `Docking Manager` then this button opens the editor for configuring initial position of tabs within container. Please note, user can later change the layout configuration when dashboard is running. User changes are saved in `.eez-project-runtime-settings` file, created at the same location where the `.eez-project` file is.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _eez-gui-widgets-demo_
