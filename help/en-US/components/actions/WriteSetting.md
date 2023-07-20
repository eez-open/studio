# DESCRIPTION

This Action will add the set `Key` to the _.eez-project-runtime-settings_ file (it's the same file where persistent variables are saved), or it will update the value with `Value` of that key if it already exists.

NOTE: _WriteSetting_ and _ReadSetting_ Actions are used to save and retrieve from the _eez-project-runtime-settings_ file all those settings that we want to survive the _Dashboard_ project restart. It is more convenient to use persistent variables, because in that case we do not have to execute a special Action for saving and retrieving.

# PROPERTIES

## Key

A string containing the name of the key to be added/updated.

## Value

The value of the key that will be created or updated.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
