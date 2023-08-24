# DESCRIPTION [DRAFT]

Koristite ovaj widget kada želite unjeti broj ili tekst. Da bi ovaj widget radio project mora definirati page za unos teksta i page za unos broja. Pogledajte neki od primjera koji su navedeni pod Examples kako se definiraju te stranice.

# PROPERTIES

## Data [DRAFT]

Varijabla u koju će biti pospremljen uneseni broj ili tekst.

## Default style [DRAFT]

Style koji se koristi za renderiranje.

## Input type [DRAFT]

Odabir da li se unosti `Number` ili `Text`.

## Min [DRAFT]

Ako je `Input type` postavljen na `Number` onda ovaj broj predstavlja minimalni broj koju je potrebno unjeti, a ako je postavljen na `Text` onda ovaj property pretstavlja minimalan broj znakova koje je potrebno unjeti.

## Max [DRAFT]

Ako je `Input type` postavljen na `Number` onda ovaj broj predstavlja maksimalni broj koju je potrebno unjeti, a ako je postavljen na `Text` onda ovaj property pretstavlja maksimalan broj znakova koje je potrebno unjeti.

## Precision [DRAFT]

Ako je `Input type` postavljen na `Number` onda ovaj property definira preciznost broja koji se unosi. Ako se unese broj koji ima veću preciznost (više decimalnih mjesta) onda će se broj zaokružiti na ovu preciznost. Npr. ako postavite na 0.01 onda će broj biti zaokružen na dvije decimale.

## Unit [DRAFT]

Ako je `Input type` postavljen na `Number` onda ovaj property definrira unit koji će se koristiti, tj. ispisati desno od brojčane vrijednosti.

## Password [DRAFT]

Ako je `Input type` postavljen na `Text` i unosi se password onda treba enejblati ovaj property kako bi se prikazale `*` umjesto znakova prilikom unosa passworda.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
-   stm32f469i-disco-eez-flow-demo
