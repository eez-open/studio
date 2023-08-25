# DESCRIPTION

The widget is used when we want to enter a number or text. In order for this widget to work, the project must define a page for entering text and a page for entering numbers. See some of the examples listed under _Examples_ of how these pages are defined.

# PROPERTIES

## Data

The variable in which the entered number or text will be stored.

## Default style

Style used when rendering of the Widget.

## Input type

Choose whether `Number` or `Text` is entered.

## Min

If `Input type` is set to `Number` then this number represents the minimum number that needs to be entered, and if it is set to `Text` then this property represents the minimum number of characters that need to be entered.

## Max

If `Input type` is set to `Number` then this number represents the maximum number that needs to be entered, and if it is set to `Text` then this property represents the maximum number of characters that need to be entered.

## Precision

If `Input type` is set to `Number` then this property defines the precision of the entered number. If a number with higher precision (more decimal places) is entered, then the number will be rounded to this precision. For example if we set it to `0.01` then the number will be rounded to two decimal places.

## Unit

If `Input type` is set to `Number` then this property defines the unit that will be used, i.e. printed to the right of the numerical value.

## Password

If `Input type` is set to `Text` and a password is entered, then this property should be enabled so that `*` is displayed instead of characters when entering the password.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _eez-gui-widgets-demo_
* _stm32f469i-disco-eez-flow-demo_
