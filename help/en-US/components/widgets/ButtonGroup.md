# DESCRIPTION [DRAFT]

Prikazuje grupu buttona. Koliko ima buttona i njihove labele su definirane propertijem `Button labels`. Jedan od tih buttona može biti selected, što je definirano `Selected button` propertijem. Ako je button selected onda se koristi `Selected` style, inače se koristi `Default` style prilikom rendereiranja pojedinog buttona.

# PROPERTIES

## Button labels [DRAFT]

Ovaj property definira labele svih buttona. Koliko ima elemenata u ovom polju stringova toliko će biti i buttona.

## Default style [DRAFT]

Ovaj style se koristi prilikom renderiranja buttona koji nije selected.

## Selected button [DRAFT]

Ovaj property definira koji je button selected. To je zero-based integer, što znači ako je njegova vrijednost 0 biti će selektiran prvi button, ako je njegova vrijednost 1 biti će selektiran drugi button, itd. Ako želite da niti jedan button nije selektiran koristite vrijednost -1 za ovaj property.

## Selected style [DRAFT]

Ovaj style se koristi prilikom renderiranja buttona koji je selected.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
