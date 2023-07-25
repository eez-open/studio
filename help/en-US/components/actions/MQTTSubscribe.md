# DESCRIPTION

This Action must be performed immediately after successfully connecting to the MQTT server, for each topic to which we want to subscribe. If a packet has been published by the server for this topic, we will receive information about it via the Message event using the _MQTTEvent_ Action.

# PROPERTIES

## Connection

The name of the connection to the MQTT server.

## Topic

The name of the topic to which we want to subscribe. A subscription may be to an explicit topic, in which case only messages to that topic will be received, or it may include wildcards. Two wildcards are available, `+` or `#`. `+` can be used as a wildcard for a single level of hierarchy. It could be used with the topic above to get information on all computers and hard drives as follows:

`sensors/+/temperature/+`

As another example, for a topic of `a/b/c/d`, the following example subscriptions will match:

```
a/b/c/d
+/b/c/d
a/+/c/d
a/+/+/d
+/+/+/+
```

The following subscriptions will not match:

```
a/b/c
b/+/c/d
+/+/+
```

`#` can be used as a wildcard for all remaining levels of hierarchy. This means that it must be the final character in a subscription. With a topic of `a/b/c/d`, the following example subscriptions will match:

```
a/b/c/d
#
a/#
a/b/#
a/b/c/#
+/b/c/#
```

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

- _MQTT_
