# DESCRIPTION

The action is used to execute an external command, i.e. program, which can be in the PATH or the full path to the command can be specified.

# PROPERTIES

## Command

The name of the command, i.e. the full file path to the command to be executed.

## Arguments

Array of string arguments that is passed to the command.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## stdout

The `stream` value from `stdout` is sent through this output. That `stream` value can be collected into a string with the _CollectStream_ Action, redirected to a _Terminal_ widget, parsed with the _RegExp_ Action, etc.

## stderr

The `stream` value of `stderr` is sent through this output. That `stream` value can be collected into a string with the _CollectStream_ Action, redirected to a _Terminal_ widget, parsed with the _RegExp_ Action, etc.

## finished

If the command completed successfully, Flow execution continues through this output. If an error has occurred, an error is thrown that can be caught if `Catch error' is enabled.

# EXAMPLES

- _RegExp Stream_
