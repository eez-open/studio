# DESCRIPTION

Binds to TCP port and listen for the incomming connections.

# PROPERTIES

## Port

Port to which we bind.

## IP Address

Address to which we bind.

## Max. Connections

Max allowed active incoming connections.

# INPUTS

## seqin

A standard sequence input.

## end

Stop listening and unbind from the port. Will trigger `close` output.

# OUTPUTS

## seqout

A standard sequence output.

## connection

Output to which the socket for the incoming connection is sent.

## close

Will trigger when listening stops.

# EXAMPLES

-   _TCP CLient_
-   _TCP Server_
