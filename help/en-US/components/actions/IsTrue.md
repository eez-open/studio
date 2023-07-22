# DESCRIPTION

The set expression is evaluated and if it is `true`, the Flow execution continues through the `Yes` output, otherwise on the `No` output. At least one of those two outputs must be connected by a line to an input.

By default, when this action is added to the Flow, a `Value` input is added and it is tested whether it is `true` or `false`. If we want to test another expression, we should delete that input in the Flow section of the property and enter the expression we want.

# PROPERTIES

## Value

Expression whose result is tested.

# INPUTS

## seqin

A standard sequence input.

## value

The input through which the Value to be tested is received. This input can be deleted (we delete it in the Flow - Inputs list) if it is not needed, i.e. if you want to test another expression.

# OUTPUTS

## seqout

A standard sequence output.

## Yes

Output that will be used to continue execution of the Flow if the value of the expression is `true`.

## No

Output that will be used to continue execution of the Flow if the value of the expression is `false`.

# EXAMPLES [EMPTY]
