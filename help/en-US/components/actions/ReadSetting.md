# DESCRIPTION

This action, for the defined key name, returns the saved value, or `null` if that key does not exist, from the _.eez-project-runtime-settings_ file (it's the same file where persistent variables are saved).

NOTE: _WriteSetting_ and _ReadSetting_ Actions are used to save and retrieve from the _eez-project-runtime-settings_ file all those settings that we want to survive the _Dashboard_ project restart. It is more convenient to use persistent variables, because in that case we do not have to execute a special Action for saving and

# PROPERTIES

## Key

A string containing the name of the key whose value is to be retrieved.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence ouput.

## value

The obtained `Value` of the defined `Key` is sent through this output.

# EXAMPLES [EMPTY]
