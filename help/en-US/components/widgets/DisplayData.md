# DESCRIPTION [DRAFT]

Ovo je slično kao Text widget ali ima još neke opcije koje se zadaju preko `Display option` i `Refresh rate` propertija.

# PROPERTIES

## Data [DRAFT]

Ovaj ekspression kada sa izračuna pretvori se u string i prikazuje unutar widgeta.

## Default style [DRAFT]

Ovo je style koji se koristit prilikom renderiranja ovog widgeta.

## Focused style [DRAFT]

Ovaj style se koristi prilikom renderiranja ako je widget u focusu.

## Display option [DRAFT]

Ako je izračunati `Data` floating point broj onda s ovim propertijem možemo birati koji dio floating point broja se prikazuje:

-   `All`: prikazuje čitav floating point broj
-   `Integer`: prikazuje samo cijeli dio (integer) broja
-   `Fraction`: prikazuje samo decimale (fraction) broja

## Refresh rate [DRAFT]

Ovaj property definira koliko ćesto će se obnavljati sadržaj ovog widgeta i zadaje se u milisekundama. Npr. ako se Data mijenja sa velikom frekvencijom i ako se sa tom frekvencijom obnavlja i sadržaj ovog widgeta (npr. ako je Refresh rate postavljen na 0) onda će biti problematično vidjeti taj sadržaj, pa je preporučljivo Refresh rate povećati, npr. na 200 ms.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
