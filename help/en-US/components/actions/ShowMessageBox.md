# DESCRIPTION

This Action is used to display _Info_, _Error_ or _Question_ message boxes.

# PROPERTIES

## Message type

Defines the message box that will be displayed:

-   `Info`

![Alt text](../images/show_message_box_info.png)

-   `Error`

![Alt text](../images/show_message_box_error.png)

-   `Question`

![Alt text](../images/show_message_box_question.png)

## Message

The content of the message to be displayed.

## Buttons

This property needs to be defined only for the _Question_ message box. An array of strings is expected here, where each string is mapped to a button, eg `["Save", "Don't Save", "Cancel"]`. It is necessary to add one output in the "Flow - Outputs" section for each button, through which the Flow execution will continue if that button is pressed.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

-   _Keyboard, Keypad and Message Box_
