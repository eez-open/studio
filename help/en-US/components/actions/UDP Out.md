# DESCRIPTION

This actions sends message to the designated UDP host and port.

# PROPERTIES

## Send a

Options to send UDP, Multicast or Broadcast message

## To port

The port to which message is sent.

## Address

The address to which message is sent.

## Group

If Multicast mode is selected, specify multicast group you whish to join.

## Local interface

Specify local network interface for multicast group. If this option is not specified, the operating system will choose one interface and will add membership to it.

## Ipv

Use IPV4 or IPV6 addresses

## Bind to

Option to bind to the random or fixed port.

## Outport

If fixed port option is selected then specify fixed port with this property.

## Payload

Message payload to be sent.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

-   _UDP CLient_
-   _UDP Server_
