# DESCRIPTION

Creates and initializes a Serial connection object with connection parameters that are defined through properties. This Action must be executed first, after which the _SerialConnect_ Action must be called.

# PROPERTIES

## Connection

Connection object of type `object:SerialConnection` to be created and initialized.

## Port

Serial port name.

## Baud rate

Serial port speed.

## Data bits

Serial port data bits. Allowed values are `5`, `6`, `7` or `8`.

## Stop bits

Serial port stop bits. Allowed values are `1` or `2`.

## Parity

Serial port parity. Allowed values are `"none"`, `"even"`, `"mark"`, `"odd"` or `"space"`

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
