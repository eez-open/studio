# DESCRIPTION [DRAFT]

Converts the Flow value to a CSV string and sends it to the `result` output.

# PROPERTIES

## Input [DRAFT]

Flow value that will be converted into a CSV string.

## Delimiter [DRAFT]

Defines the character used to delimitate the fields inside a CSV record. Default is `","`.

## Header [DRAFT]

If set to `true` this option will generate the column names in the first emitted record.

## Quoted [DRAFT]

If set to `true` this option will quote all the non-empty fields even when there is no character requiring quotes.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

## input [DRAFT]

The input through which the Flow value which will be converted to CSV string is received. This input can be deleted (we delete it in the Flow - Inputs list) if it is not needed, i.e. if we want to parse a string obtained by evaluating an arbitrary expression set through `Input` property.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## result [DRAFT]

The constructed CSV string is sent through this output.

# EXAMPLES [DRAFT]

-   CSV
