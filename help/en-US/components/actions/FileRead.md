# DESCRIPTION

Reads the contents of a file as either a string or blob and sends it to the `content` output

# PROPERTIES

## File path

The full path of the file to be read.

## Encoding

Encoding of the input data. Possible values are: `"ascii"`, `"base64"`, `"hex"`, `"ucs2"`, `"ucs-2"`, `"utf16le"`, `"utf-16le"`, `"utf8"`, `"utf-8"`, `"binary"` or `"latin1"`.

If encoding is `"binary"` then the blob value is returned, otherwise the string value is returned.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## content

The read content of the file is sent through this output.

# EXAMPLES

- _JSON_
- _CSV_
- _EEZ Chart_
