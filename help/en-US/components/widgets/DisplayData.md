# DESCRIPTION

Similar to the `Text` Widget, but it has some more options that are set via the `Display option` and `Refresh rate` properties.

# PROPERTIES

## Data

An expression that, when calculated, is converted into a string and displayed inside the widget.

## Default style

Style used when rendering of the Widget.

## Focused style

Style to be used for rendering if the Widget is in focus.

## Display option

If the calculated `Data` is a floating point number, then with this property we can choose which part of the floating point number is displayed:

- `All` – displays the entire floating point number
- `Integer` – displays only the whole part (integer) of the number
- `Fraction` – displays only decimals (fractions) of a number

## Refresh rate

This property defines how often the content of this widget will be refreshed. It is set in milliseconds. If the `Data` changes with a high frequency and if the content of this widget is renewed with that frequency (e.g. if the Refresh rate is set to `0`) then it will be a problem to see that content, therefore it is recommended to increase the Refresh rate, eg. at 200 ms.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _eez-gui-widgets-demo_
