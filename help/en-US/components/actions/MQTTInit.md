# DESCRIPTION

Creates and initializes an MQTT connection object with connection parameters that are defined through properties.
This Action must be executed first, and after it the _MQTTEvent_ Action must be called.

# PROPERTIES

## Connection

Connection object of type `object:MQTTConnection` which will be created and initialized.

## Protocol

The protocol used for the connection. Possible values are `"mqtt"` or for secure connection `"mqtts"`

## Host

The name of the MQTT server to connect to.

## Port

The port number that will be used for the connection. The default is `1883`.

## User name

Username to be used for connection authorization. Can be left blank if not used.

## Password

User password to be used for connection authorization. Can be left blank if not used.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

- _MQTT_
