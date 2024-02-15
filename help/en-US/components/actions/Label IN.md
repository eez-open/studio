# DESCRIPTION

This action is used in combination with `Label OUT` action. All lines entering `Label OUT` will end up through `Label IN` with the same label name within the same flow (i.e. _Page_ or _User_ Action). So, "jumping" from one flow to another is not allowed. There can be multiple `Label OUT` and only one `Label IN` with the same label name.

# PROPERTIES

## Label

The name of the label that connects the `Label IN` and `Label OUT` actions.

# INPUTS [EMPTY]

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
