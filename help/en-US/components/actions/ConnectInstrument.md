# DESCRIPTION

Initiates asynchronous connection to the instrument, i.e. the Action will not wait for us to disconnect from the instrument before exiting to `seqout`, but exits immediately. We can check whether we are connected or not with `instrument_variable.isConnected`. For example we can monitor this expression within the _Watch_ Action in order to catch the moment when connection to the instrument occurred to start sending SCPI commands.

# PROPERTIES

## Instrument

Instrument object to connect to.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
