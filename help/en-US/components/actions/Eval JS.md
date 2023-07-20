# DESCRIPTION

It evaluates a JavaScript expression and sends the result through `result` output.

# PROPERTIES

## Expression

The JavaScript expression to be evaluated. EEZ Flow expression written inside curly brackets can be inserted in several places within the expression.  
For example in the JavaScript expression `Math.random() * {num_items}`, this `{num_items}` is a Flow expression, i.e. it takes the value of the `num_items` variable that comes from the Flow before handing it off to JavaScript to calculate the complete expression.


# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## result

Output through which the result of JavaScript expression evaluation is sent. By default, `Type` of the output is set to `any`, so it is preferable to change it to a specific type.

# EXAMPLES [EMPTY]
