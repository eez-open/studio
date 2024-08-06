# DESCRIPTION

This widget is work in progress, it means that you can add it to your project and Studio will generate all the code for its creation, but for anything more than that you should do it in your custom code, for example after `ui_init()` has been called.

[More info](https://docs.lvgl.io/master/widgets/spinbox.html)

# PROPERTIES

## Digit count

The number of digits excluding the decimal separator and the sign

## Separator position

The number of digits before the decimal point

## Min

The minimum value that can be selected.

## Max

The maximum value that can be selected.

## Rollover

Enables/disabled rollover mode. If either the minimum or maximum value is reached with rollover enabled, the value will change to the other limit. If rollover is disabled the value will remain at the minimum or maximum value.

## Step

Sets the cursor to a specific digit to change on increment/decrement. For example position '1' sets the cursor to the least significant digit. Only multiples of ten can be set, and not for example 3.

## Step type

Select between `Literal` and `Assignable`. If `Assignable` is selected then `Step` can be variable in which the selected step will be stored.

## Value

The selected value on the Spinbox.

## Value type

Select between `Literal` and `Assignable`. If `Assignable` is selected then `Value` can be variable in which the selected value will be stored.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Spinbox_
