# DESCRIPTION

With this Action we can add one or more event handlers that can be received by the TCP socket.

# PROPERTIES

## Socket

The socket object on which we want to listen to events.

## Event handlers

List of events to be handled. For each item in the list, it will be necessary to select `Event`, `Handler type` and optionally `Action`. `Event` is the type of event we want to handle and the possible values are:

-   `Ready` – Emitted when a socket is ready to be used.
-   `Data` – Emitted when data is received.
-   `Close` – Emitted once the socket is fully closed.
-   `End` – Emitted when the other end of the socket signals the end of transmission, thus ending the readable side of the socket.
-   `Error` – Emitted when an error occurs. The 'close' event will be called directly following this event.
-   `Timeout` – Emitted if the socket times out from inactivity. This is only to notify that the socket has been idle. The user must manually disconnect the connection.

`Handler type` can be `Flow` or `Action`. If `Flow` is selected then an output will be added through which the Flow execution continues if the event is sent. If `Action` is selected, then `Action` must also be set, i.e. the name of the User action that is executed when the event is received.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

-   _TCP CLient_
-   _TCP Server_
