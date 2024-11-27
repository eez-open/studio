# DESCRIPTION

Displays a Terminal window through which the user can enter arbitrary text, as the text is entered, character by character is sent through the `onData` output. It is also possible to enter text into the terminal through flow using the `Data` property.

# PROPERTIES

## Data

The text that is entered in the Terminal window. It is necessary to add flow input of type `string` or `stream` and enter the name of that input in this property. If the flow input is of the `string` type, then it is necessary to send a string to that input that you want to enter in the terminal – this can be done multiple times, i.e. every time a string is received at that input, it will be entered in the terminal. If the flow input is of `stream` type, then the Terminal Widget listens to see if there is any new data on the stream and when it appears, it writes it to the terminal – for example, in this way it is possible to connect `stdout` or `stderr` output from `ExecuteCommand` Actions on the `Terminal` Widget.

## Default style

Style used when rendering of the Widget.

# INPUTS [EMPTY]

## clear

# OUTPUTS [EMPTY]

## onData

Through this output, the entered text is sent character by character.

# EXAMPLES

* _Dashboard Widgets Demo_
