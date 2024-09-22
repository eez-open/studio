# DESCRIPTION

Use this action to output message received on specified UDP port.

# PROPERTIES

## Listen for

Select UDP or Multicast mode.

## Group

If Multicast mode is selected, specify multicast group you whish to join.

## Local interface

Specify local network interface for multicast group. If this option is not specified, the operating system will choose one interface and will add membership to it.

## On port

The port from which we want to receive messages.

## Using

Use IPV4 or IPV6 addresses

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## message

Output to which the received message is sent. The type of message is `struct:$UDPMessage` with following fields:

-   `payload`: message payload received as `blob`, use `Blob.toString()` to convert to the string value.
-   `address`: remote IP address
-   `port`: remote IP port

# EXAMPLES

-   _UDP CLient_
-   _UDP Server_
