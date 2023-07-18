# DESCRIPTION [DRAFT]

Evaluira se zadani expression i ako je true izlazi se na `Yes` output, inače na `No` output. Barem jedan od ta dva outputa mora biti linijom spojen na neki input.

By default, kada se ova akcija doda u flow, dodan je `Value` input i za njega se provjerava da li je `true` ili `false`. Ako se želi provjeriti neki drugi expression slobodno izbrišite taj input u Flow sekciji propertija i unesite expression koji želite.

# PROPERTIES

## Value [DRAFT]

Expression čiji se rezultat testira.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

## value

Input preko kojeg se prima Value koji se testira. Ovaj input se može obrisati (briše se u Flow - Inputs listi) ako nije potreban, tj. ako se želi testirati neki drugi expression.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## Yes [DRAFT]

Output na koji se izlazi ako je vrijednost expressiona `true`.

## No [DRAFT]

Output na koji se izlazi ako je vrijednost expression `false`.

# EXAMPLES [EMPTY]
