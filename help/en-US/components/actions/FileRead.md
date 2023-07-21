# DESCRIPTION [DRAFT]

Reads the contents of a file as either a string or blob and sends it to the `content` output

# PROPERTIES

## File path [DRAFT]

The full path of the file to be read.

## Encoding [DRAFT]

Encoding of the input data. Possible values are: "ascii", "base64", "hex", "ucs2", "ucs-2", "utf16le", "utf-16le", "utf8", "utf-8", "binary" or "latin1".

If encoding is "binary" then the blob value is returned, otherwise the string value is returned.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## content [DRAFT]

Kroz ovaj ouput se šalje pročitani sadržaj fajla.

# EXAMPLES [DRAFT]

-   JSON
-   CSV
-   EEZ Chart
