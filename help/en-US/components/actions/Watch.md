# DESCRIPTION [DRAFT]

Ova akcija, za cijelo vrijeme trajanja izvršavanja flowa, u pozadini evaluira zadani expression i ako je došlo do promjene rezultata proslijeđuje ga na data output. Na početku, kod pokretanja flowa, expression se evaluira i proslijeđuje na data output, a kasnije samo ako je došlo do promjene.

# PROPERTIES

## Expression [DRAFT]

Expression koji se evauluira.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## changed [DRAFT]

Output kroz koji se proslijeđuje vrijednost evaluiranog expressiona jednom na početku i kasnije samo ako je došlo do promjene u rezultatu.

# EXAMPLES [EMPTY]
