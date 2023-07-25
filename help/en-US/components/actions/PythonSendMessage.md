# DESCRIPTION

Sends a message from Flow to a running Python script.

# PROPERTIES

## Handle

The handle obtained during the execution of the _PythonRun_ action is used to determine which script we want to send the message to, since multiple scripts can be executed at the same time.

## Message

Message to be sent.

# INPUTS

## seqin

A standard sequence input.

## handle

The handle can also be passed through this input. If the handle is obtained in some other way, e.g. from a variable via the `Handle` property, then this input can be removed in the "Flow - Inputs" section.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

- _Charts_
