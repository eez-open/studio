# DESCRIPTION [DRAFT]

Ova akcija skuplja stream u string. Kako podaci iz streama dolaze u chunkovima, oni se konkateniraju u string i šalju na data output. Dakle, tijekom života streama ova akcija može više puta slati kroz `data` do tada sakupljeni string. Kada je stream zatvoren, izlazi se kroz `seqout` output.

# PROPERTIES

## Stream [DRAFT]

Stream koji se skuplja u string.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output. Kroz ovaj output se izlazi kada se stream zatvori.

## data [DRAFT]

Kroz ovaj output se šalje do tog trenutka sakupljeni string. Dakle, tijekom života streama kroz ovaj output se može u više navrata poslati string, a taj string uvijek sadrži sve do tada prikupljene podatke.

# EXAMPLES [DRAFT]

    - RegExp Stream
