# DESCRIPTION

Opens the numeric keypad page for numerical input. The numeric keypad page must be in the project and its ID must be 3. The numeric keypad page can also be opened with the _Input_ Widget.

See in the _Keyboard, Keypad and Message Box_ example how the numeric keypad page is defined:

![Alt text](../images/show_keypad.png)

# PROPERTIES

## Label

The label that will be displayed on the keyboard page (e.g. the name of the parameter whose value is entered).

## Inital value

Initial (default) number that will be displayed in the input field.

## Min

The entered number must be greater than or equal to this number.

## Max

The entered number must be less than or equal to this number.

## Precision

Defines the rounding precision of the entered number. For example if a maximum of two decimal digits is desired, then `0.01` should be entered here.

## Unit

Units that will be displayed when entering a number.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## result

Output to which the entered numeric value is sent.

## canceled

Flow execution continues through this output if the cancel button is pressed.

# EXAMPLES

-   _stm32f469i-disco-eez-flow-demo_
-   _eyboard, Keypad and Message Box_
