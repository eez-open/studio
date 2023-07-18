# DESCRIPTION

The expressions added to the `Cases` list are evaluated one by one, starting from the first one in the list. The `Then output` of the first expression whose evaluation result will be `true` will be used for the output on which the Flow execution will continue. The value `true` will be passed to that output unless a `With value` expression is defined.

During Flow execution, it may happen that none of the specified cases in the list returns `true` during evaluation. To prevent this from happening and stop further execution of the Flow, a case can be added at the end of the list in which `true` will be entered in the `When` parameter so that the result of the evaluation will always be true and it will be possible to exit through its output.

# PROPERTIES

## Cases

Each element of this list contains:

- `When` - an expression that is evaluated to see if it is `true`.
- `Then output` - the name of the output through which the execution of the Flow continues if the result of the evaluation of expression `When` is `true`.
- `With value` - optional parameter, if set as an expression, is passed to the output, if not defined `true` is passed.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
