# DESCRIPTION

This action, for the entire duration of Flow execution, evaluates the default expression in the background and if there is a change in the result, it forwards it to the data output. At the beginning, when the Flow is started, the expression is evaluated and forwarded to the data output, and later only if some change has occurred.

# PROPERTIES

## Expression

Expression to be evaluated.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## changed

Output through which the value of the evolved expression is passed once at the start and later only if there was some change in the result.

# EXAMPLES [EMPTY]
