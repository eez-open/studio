# DESCRIPTION

Initiates the termination of the connection with the server, which will be confirmed with the `Close` event and then the `End` event.

# PROPERTIES

## Connection

The name of the MQTT connection to the server to which the communication will be terminated.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output. Flow execution continues immediately through this output, and in the background it tries to disconnect from the server.

# EXAMPLES

- _MQTT_
