# DESCRIPTION

If this action is used inside Page or User Widget, it will move the position of the animation timeline from one position (`From` property) to another (`To` property) with given speed (`Speed` property).

If we want to instantly jump to a certain position (`To` property), then we should set the Speed to `0` - in that case the `From` property value doesn't matter (it can be set to the same value as `To` property).

The expression `Flow.pageTimelinePosition()` can be used for the `From` property and in that case the animation will start from the current position.

# PROPERTIES

## From

Start position set in seconds.

## To

End position set in seconds.

## Speed

Determines the duration of the animation. If set to `1` then the animation will last `From - To` seconds. If we want a twice as fast animation then it should be set to `2`, and if we want a twice slower animation then it should be set to `0.5`.

If we want the animation to last a specific time `T` then the formula `T / (From - To)` can be used, e.g. if `T` is equal to `0.5` seconds, From `1` seconds and To `3` seconds, then `0.5 / (3 - 1)` should be set for speed, i.e. `0.25`.

If it is set to `0` then it will immediately jump to the `To` position during execution.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output. It is activated when the animation is finished, ie. when the `To` position was reached.

# EXAMPLES

- _Animation_
- _sld-eez-flow-demo_
