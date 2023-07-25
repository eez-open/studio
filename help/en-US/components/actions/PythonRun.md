# DESCRIPTION

Runs a python script and sends the handle of the running script to the `handle` output. This handle is used in the `PythonEnd` Action if we want to stop a running Python script or in the `PythonSendMessage` Action if we want to send a message from Flow to a Python script, and it is needed because several scripts can be started at some point and the running script is determined through this handle.

# PROPERTIES

## Script source option

The source of the python script can be specified in three ways:

-   Inline script
-   Inline script as expression
-   Script file

## Inline script

If `Inline script` was selected for `Script source option`, then the source code of the script should be entered here.

## Inline script as expression

If `Inline script as expression` was selected for `Script source option`, then here you need to enter an expression that will return a string containing the source code of the script when evaluated.

## Script file

If `Script file' was selected for `Script source option', then the file path to the `.py' file should be entered here.

## Python path

The full path to the python command. If the python command is already in the system path, then it can be set to an empty string, i.e. `""`.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## handle

Returns the handle of the running script used in _PythonEnd_ and _PythonSendMessage_ Actions.

## message

Everything that is printed to `stdout` within the running Python script will be sent through this output. In this way, the python script sends a message to Flow, and if Flow wants to send a message to the Python script, then the _PythonSendMessage_ Action should be used.

# EXAMPLES

- _Charts_
