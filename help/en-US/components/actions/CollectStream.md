# DESCRIPTION

Concatenates a stream into a string. As data from the stream comes in chunks, they are concatenated into a string and sent to the data output. During the stream lifetime, this Action can repeatedly send the currently collected string through `data`. Flow execution continues through the `seqout` output when the stream is closed.

# PROPERTIES

## Stream

A stream whose content will be concatenated into a string.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output. Flow execution continues through this output after the stream is closed.

## data

The concatenated string is sent through this output.
During the stream lifetime, a string can be sent several times, which will contain all the data collected until then (i.e. the string will grow over time as new data arrives).

# EXAMPLES

- _RegExp Stream_
