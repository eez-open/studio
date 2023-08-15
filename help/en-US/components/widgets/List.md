# DESCRIPTION [DRAFT]

Koristite ovaj widget kada želite isti widget prikazati više puta, tj. multiplicirati. Ovaj widget pod sobom ima jedan child widget, a koliko puta će se on prikazati ovisi o `Data` propertiju. Multiplicirani widgeti se mogu prikazati vertikalno jedan isod drugoga ili horizontalno jedan do drugoga, što ovisi o `List type` propertiju.

Ne bi bilo previše korisno kada bi multiplicirani widgeti uvijek imali isti sadržaj, zato postoji sistemska varijabla `$index` koja nam govori koji po redu widget se renderira. Ta varijabla je zero based, znači kada je njena vrijednost 0 onda se renderira prvi widget, kada je njena vrijednost 1 onda se renderira drugi widget, itd. Taj `$index` se onda može koristiti unutar expressiona od propertija od child widgeta i na taj način se postiže da svaki renderirani widget ima drugačiji sadržaj (npr. Text widget može prikazati neki string koji se uzima iz neke array varijable: `country_cities[$index].country`).

# PROPERTIES

## Data

## Default style [DRAFT]

Ovaj style se koristi prilikom renderiranja pozadine List widgeta.

## Item widget

## List type

## Gap

# INPUTS

# OUTPUTS

# EXAMPLES

    - CSV
    - JSON
    - MQTT
    - Simple HTTP
    - Charts
    - Regexp String
    - Multi-Language
