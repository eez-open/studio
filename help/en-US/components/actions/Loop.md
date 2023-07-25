# DESCRIPTION

This Action is used to execute a specific part of the Flow in a loop. The Action should be placed at the beginning of the part of the Flow that will be executed in a loop and is entered at the `Start` input, and at the end of that part of the Flow it should be returned to this Action, but now through the `Next` input.
Each time the Flow passes through this Action, the value of the set variable will change from the `From` to the `To` value with the `Step` value.
Flow execution will go through `(From - To + 1) / Math.abs(step)` times before the iteration completes, and passes through the `Done` output.
If we want to stop the iteration before the `To` value is reached, then we simply don't need to return to the `Next` input. Also, it is possible to use _SetVariable_ to change the variable by which it is iterated, and thus skip one or more steps.

![Alt text](../images/loop.png)

# PROPERTIES

## Variable

A variable that determines the number of passes through the loop and whose value will be changed and tested to see if a new iteration is needed.

## From

The initial value of the variable.

## To

The final value of the variable.

## Step

The value by which the variable is changed on each pass. It can be a positive or negative number.

# INPUTS

## start

When this input is passed, the variable is set to the `From` value and Flow execution continues through `seqout`.

## next

When this input is passed, the variable is changed by the `Step` value. It is tested whether it is less than or equal to `To` value if `Step` is positive, or whether it is greater than or equal to if `Step` is negative.

If the variable has not exceeded the `To` value, then Flow execution continues through `seqout`, otherwise it continues through `Done` output.

# OUTPUTS

## seqout

Flow execution continues through this output for the duration of the iteration.

## done

Flow execution continues through this output when the iteration is complete.

# EXAMPLES

- _Loop_
