# DESCRIPTION

Opens the keyboard page for text input. The keyboard page must be in the project and its ID must be 2. The keyboard page can also be opened with the _Input_ Widget.

See in the _Keyboard, Keypad and Message Box_ example how the keyboard page is defined:

![Alt text](../images/show_keyboard.png)

# PROPERTIES

## Label

The label that will be displayed on the keyboard page (e.g. the name of the parameter whose value is entered).

## Inital text

Initial (default) text that will be displayed in the input field.

## Min chars

Defines the minimum length of the entered text.

## Max chars

Defines the maximum length of the entered text.

## Password

Used when entering hidden text such as a user's password. When it is enabled, every character will be replaced with `*` when entered.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## result

Output to which the entered text is sent.

## canceled

Flow execution continues through this output if the cancel button is pressed.

# EXAMPLES

-   _Keyboard, Keypad and Message Box_
-   _stm32f469i-disco-eez-flow-demo_
