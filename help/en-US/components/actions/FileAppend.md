# DESCRIPTION

Appends data to a file. It will create the file if it doesn't already exist. The data can be a string or a blob.

# PROPERTIES

## File path

The full path of the file to be written.

## Content

Content to be written. It can be a string or a blob. If the content is a blob, the `encoding` property is ignored.

## Encoding

Encoding type of string content. The following values are allowed: `"ascii"`, `"base64"`, `"hex"`, `"ucs2"`, `"ucs-2"`, `"utf16le"`, `"utf-16le"`, `"utf8"`, `"utf-8"`, `"binary"` or `"latin1"`.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
