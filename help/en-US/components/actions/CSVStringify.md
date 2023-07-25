# DESCRIPTION

Converts the Flow value to a CSV string and sends it to the `result` output.

# PROPERTIES

## Input

Flow value that will be converted into a CSV string.

## Delimiter

Defines the character used to delimit fields within a CSV record. The default delimiter is `","`.

## Header

If it is set to `True`, the first record will contain the names of the columns.

## Quoted

If it is set to `True`, all non-empty fields will be quoted even if there are no characters that require quoting.

# INPUTS

## seqin

A standard sequence input.

## input

The Flow value to be converted into a CSV string is received through this Input. This Input can be deleted (we delete it in the Flow - inputs list) if it is not needed, i.e. if we want to parse the string obtained by evaluating an arbitrary expression set through the `Input` property.

# OUTPUTS

## seqout

A standard sequence output.

## result

The constructed CSV string is sent through this output.

# EXAMPLES

- _CSV_
