# DESCRIPTION

It is used to terminate the execution of a Flow.

If it is inside the page, it means the end of the application execution. If it is a _Dashboard_ project that is executed within the project editor, this means switching from _Run_ mode to _Edit_ mode. 
If it is a _Dashboard_ running on the instrument, the execution will be interrupted and a _Start_ button will appear with which the _Dasboard_ can be restarted.
If it is _Dashboard_ as a standalone application then the application will be closed.

If it is used within a User action, it means the end of the execution of the User action and the activation of the standard sequence line at the point where the User action was called.

This Action has no effect if it is inside a User widget in Flow.

# PROPERTIES

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

# EXAMPLES [EMPTY]
