# DESCRIPTION

It is used to process events that can be broadcast within the page where the Action is located.

# PROPERTIES

## Event

Event to be processed. The following page events are available:

- `Page open` - emitted when the page becomes active, eg when it is displayed with the `ShowPage' Action.

- `Page close` - emitted when the page becomes inactive.

- `Keydown` - emitted when a key on the keyboard is pressed. A string with [keyboard name](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values) is sent to the `event` output.

# INPUTS [EMPTY]

# OUTPUTS

## seqout

A standard sequence output. Flow execution continues through this output when the selected event is emitted.

## event

Through this output, additional information (if any) is sent for the broadcast event. The `Page open` and `Page close` events do not send anything through this event, and the `Keydown` event sends a string with [key name](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values).

# EXAMPLES

-   _Tetris_
