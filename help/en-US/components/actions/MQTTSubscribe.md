# DESCRIPTION [DRAFT]

Ovu akciju potrebno je izvršiti, odmah nakon uspješnog spajanja na MQTT server, za svaki topic na koji se želimo predbilježiti. Ako je publishan neki packet od strane servera za ovaj topic, informaciju o tome ćemo dobiti preko Message event koristeći MQTTEvent akciju.

# PROPERTIES

## Connection [DRAFT]

MQTT konekcija koja se koristi.

## Topic [DRAFT]

Naziv topica na koji se želimo predbilježiti. A subscription may be to an explicit topic, in which case only messages to that topic will be received, or it may include wildcards. Two wildcards are available, `+` or `#`. `+` can be used as a wildcard for a single level of hierarchy. It could be used with the topic above to get information on all computers and hard drives as follows:

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

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [DRAFT]

-   MQTT
