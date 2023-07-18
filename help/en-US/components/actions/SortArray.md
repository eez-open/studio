# DESCRIPTION

Sortira array varijablu i rezultat vraća kroz data output - znači ne radi in-place sortiranje, tj. ne modificira sadržaj array varijable. Dopušteni tipovi arraya su:

-   `array:integer`
-   `array:float`
-   `array:double`
-   `array:struct`

Ako se sortira array koji je tipa `array:struct` onda se mora zadati i `Structure  name` i `Structure field name` po kojem se sortira.

Postoje i dvije opcije: da li se želi Ascending/Descending sortiranje i da li se ignorira case ako se sortiraju stringovi.

# PROPERTIES

## Array [DRAFT]

Array varijabla koja se sortira.

## Structure name [DRAFT]

U slučaju da je array varijable tipa `array:struct`, ovdje treba odabrati naziv strukture.

## Structure field name [DRAFT]

U slučaju da je array varijable tipa `array:struct`, ovdje traba odabrati naziv fielda po kojem se sortira.

## Ascending [DRAFT]

Da li se radi ascending ili descending sortiranje.

## Ignore case [DRAFT]

Da li se ignorira case u slučaju ako se sortiraju stringovi.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## result [DRAFT]

Output kroz koji se šalje sortirani array.

# EXAMPLES [EMPTY]
