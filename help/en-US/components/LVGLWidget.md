# PROPERTIES

## Name

Widget name. We reference the Widget within the project by its name, for example in the LVGL action. For each Widget, we must choose a unique name within the entire project. This field is optional and does not need to be set if we do not need to reference the Widget.

## Code identifier [EMPTY]

## Left unit

The following options are available:

-   `px` – Left is default in pixels.
-   `%` – Left is set as a percentage in relation to the parent width.

## Top unit

The following options are available:

-   `px` – Top is set in pixels.
-   `%` – The top is set as a percentage in relation to the parent height.

## Width unit

The following options are available:

-   `px` – Width is given in pixels.
-   `%` – Width is given as a percentage in relation to the parent width.
-   `content` – Width is automatically set to fit the entire content in width.

## Height unit

The following options are available:

-   `px` – Height is given in pixels.
-   `%` – Height is given as a percentage in relation to the parent height.
-   `content` – Height is automatically set to fit the entire content in height.

## Children [EMPTY]

## Hidden

Make the object hidden.

## Hidden flag type

Here we can choose whether the `Hidden` flag state will be calculated from the Expression or not.

## Clickable

Make the object clickable by input devices.

## Clickable flag type

Here we can choose whether the `Clickable` flag state will be calculated from the Expression or not.

## Click focusable

Add focused state to the object when clicked.

## Checkable

Toggle checked state when the object is clicked.

## Scrollable

Make the object scrollable.

## Scroll elastic

Allow scrolling inside but with slower speed.

## Scroll momentum

Make the object scroll further when "thrown".

## Scroll one

Allow scrolling only one snappable children.

## Scroll chain hor

Allow propagating the horizontal scroll to a parent.

## Scroll chain ver

Allow propagating the vertical scroll to a parent.

## Scroll on focus

Automatically scroll object to make it visible when focused.

## Scroll with arrow

Allow scrolling the focused object with arrow keys.

## Snappable

If scroll snap is enabled on the parent it can snap to this object.

## Press lock

Keep the object pressed even if the press slid from the object.

## Event bubble

Propagate the events to the parent too.

## Gesture bubble

Propagate the gestures to the parent.

## Adv hittest

Allow performing more accurate hit (click) test. E.g. accounting for rounded corners.

## Ignore layout

Make the object positionable by the layouts.

## Floating

Do not scroll the object when the parent scrolls and ignore layout.

## Overflow visible

Do not clip the children's content to the parent's boundary.

## Scrollbar mode

Scrollbars are displayed according to a configured mode. The following mode(s) exist:

-   OFF: Never show the scrollbars
-   ON: Always show the scrollbars
-   ACTIVE: Show scroll bars while an object is being scrolled
-   AUTO: Show scroll bars when the content is large enough to be scrolled

## Scroll direction

Controls the direction in which scrolling happens. The following mode(s) exist:

-   NONE: no scroll
-   TOP: only scroll up
-   LEFT: only scroll left
-   BOTTOM: only scroll down
-   RIGHT: only scroll right
-   HOR: only scroll horizontally
-   VER: only scroll vertically
-   ALL: scroll any directions

## Scroll snap X

The children of an object can be snapped according to specific rules when scrolling ends.

An object can align snapped children in four ways:

-   NONE: Snapping is disabled. (default)
-   START: Align the children to the left side of a scrolled object
-   END: Align the children to the right side of a scrolled object
-   CENTER: Align the children to the center of a scrolled object

## Scroll snap Y

The children of an object can be snapped according to specific rules when scrolling ends.

An object can align snapped children in four ways:

-   NONE: Snapping is disabled. (default)
-   START: Align the children to the top side of a scrolled object
-   END: Align the children to the bottom side of a scrolled object
-   CENTER: Align the children to the center of a scrolled object

## Checked

Toggled or checked state.

## Checked state type

Here we can choose whether the `Checked` state will be calculated from the Expression or not.

## Disabled

Disabled state

## Disabled state type

Here we can choose whether the `Disabled` state will be calculated from the Expression or not.

## Focused

Focused via keypad or encoder or clicked via touchpad/mouse.

## Focus key

Focused via keypad or encoder but not via touchpad/mouse

## Pressed

Being pressed.

## Use style

Here we can select one of the globally defined Styles so that the Widget uses that Style.

## Local styles [EMPTY]

## Group

The name of the input group this widget belongs to.

## Group index

Defines the order of widgets within group. This is similar to [tabindex](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex) in HTML:

-   if "Group index" is 0 then group order is the same as in Widgets Structure
-   if "Group index" is > 0 then widget is added to the group before any widget with "Group index" 0 and before any widget with the greater "Group index" value. That is, "Group index"=4 is added before "Group index"=5 and "Group index"=0, but after "Group index"=3. If multiple widgets share the same "Group index" value, their order relative to each other follows their position in the Widgets Structure.
