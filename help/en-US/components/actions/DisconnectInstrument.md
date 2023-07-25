# DESCRIPTION

Initiates asynchronous disconnection from the instrument, i.e. the Action will not wait for us to disconnect from the instrument before exiting to `seqout`, but exits immediately. We can check whether we are disconnected or not with `instrument_variable.isConnected`. For example we can monitor this expression within the _Watch_ Action in order to catch the moment when disconnection from the instrument occurred.

# PROPERTIES

## Instrument

Instrument object to disconnect from.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
