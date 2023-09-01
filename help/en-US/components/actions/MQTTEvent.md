# DESCRIPTION

With this Action we can add one or more event handlers that can be received by the MQTT connection. After this Action is executed, the _MQTTConnect_ Action can be called.

# PROPERTIES

## Connection

MQTT connection to the server whose events are to be handled.

## Event handlers

List of events to be handled. For each item in the list, it will be necessary to select `Event`, `Handler type` and optionally `Action`. `Event` is the type of event we want to handle and the possible values are:

-   `Connect` – It is sent in case of successful connection or reconnect.
-   `Reconnect` – Sent when attempting to reconnect after a connection has been terminated.
-   `Close` – It is sent after the connection is terminated.
-   `Disconnect` – Sent when a disconnect packet is received by the broker.
-   `Offline` – Sent when the client goes offline.
-   `End` – Sent when the _MQTTDisconnect_ Action is performed.
-   `Error` – Sent when the client cannot connect or a parsing error has occurred.
-   `Message` – It is sent when the client receives a published packet from the server for the topic we previously subscribed to with the _MQTTSubscribe_ Action. Data of the type `struct:$MQTTMessage` is sent through the output, it is a system structure that has these members:
    -   `topic` – The name of the topic for which the packet was published.
    -   `payload` – Content of the received message.

`Handler type` can be `Flow` or `Action`. If `Flow` is selected then an output will be added through which the Flow execution continues if the event is sent. If `Action` is selected, then `Action` must also be set, i.e. the name of the User action that is executed when the event is received.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

-   _MQTT_
