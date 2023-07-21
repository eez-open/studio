# DESCRIPTION [DRAFT]

Writes data to a file, replacing the file if it already exists. Data can be a string or a blob.

# PROPERTIES

## File path [DRAFT]

The full path of the file to be written.

## Content [DRAFT]

The content to be written, either string or blob. If content is blob then `encoding` property is ignored.

## Encoding [DRAFT]

Encoding of the content. Possible values are: "ascii", "base64", "hex", "ucs2", "ucs-2", "utf16le", "utf-16le", "utf8", "utf-8", "binary" or "latin1".

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [DRAFT]

-   CSV
-   Screen Capture
