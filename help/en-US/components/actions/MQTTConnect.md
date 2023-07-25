# DESCRIPTION

This Action initiates a connection to the MQTT server, and if the connection is successful, a Connect event will be sent, or an Error event if an error occurred. If an error occurred or the once established connection was interrupted, a periodic reconnect will be attempted until the connection is re-established, which will be reported by sending a Reconnect event. All this happens asynchronously in the background, until MQTTDisconnect is called, and any state change will be reported with an event that can be processed through the _MQTTEvent_ Action.

# PROPERTIES

## Connection

The name of the MQTT connection that will be used to establish a connection with the server.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output. Flow execution continues immediately through this output, and in the background it tries to establish a connection with the server.

# EXAMPLES

- _MQTT_
