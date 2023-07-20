# DESCRIPTION [DRAFT]

Ova akcija izvršava eksternu komandu, tj. program, koji se može nalaziti u PATH-u ili se može zadati puni path do komande.

# PROPERTIES

## Command [DRAFT]

Naziv komande, odnosno puni file path do komande koja se želi izvršiti.

## Arguments [DRAFT]

Array of string arguments koji se prosljeđuje komandi.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## stdout [DRAFT]

Kroz ovaj output se šalje `stream` value od `stdout`. Taj `stream` value se može skupljati u string sa `CollectStream` akcijom, preusmjeriti u Terminal widget, parsirati sa RegExp akcijom, itd.

## stderr [DRAFT]

Kroz ovaj output se šalje `stream` value od `stderr`. Taj `stream` value se može skupljati u string sa `CollectStream` akcijom, preusmjeriti u Terminal widget, parsirati sa RegExp akcijom, itd.

## finished [DRAFT]

Ako je komanda uspješno završila, izlazi se kroz ovaj output. Ako je došlo do greške onda se throwa error koji se može loviti ako se enejbla "Catch error".

# EXAMPLES [DRAFT]

    - RegExp Stream
