# DESCRIPTION [DRAFT]

Koristite ovaj widget kada želite isti widget prikazati više puta, tj. multiplicirati. Ovaj widget pod sobom ima jedan child widget, a koliko puta će se on prikazati ovisi o `Data` propertiju. Multiplicirani widgeti se mogu prikazati tako da se prvo popunjavaju redtci ili kolone:

Ne bi bilo previše korisno kada bi multiplicirani widgeti uvijek imali isti sadržaj, zato postoji sistemska varijabla `$index` koja nam govori koji po redu widget se renderira. Ta varijabla je zero based, znači kada je njena vrijednost 0 onda se renderira prvi widget, kada je njena vrijednost 1 onda se renderira drugi widget, itd. Taj `$index` se onda može koristiti unutar expressiona od propertija od child widgeta i na taj način se postiže da svaki renderirani widget ima drugačiji sadržaj (npr. Text widget može prikazati neki string koji se uzima iz neke array varijable: `country_cities[$index].country`).

# PROPERTIES

## Data [DRAFT]

O ovom propertiju ovisi koliko će se puta child widget multiplicirati, tj. broj elemenata u listi. Vrijednost ovog propertija može biti integer i onda je to broj elemenata, a ako je vrijednost ovog propertije array onda je broj elemenata u listi jednak broju elemenata u tom arraya.

Posebno, za EEZ-GUI projekte, vrijednost ovog propertija može biti i `struct:$ScrollbarState`. Ista strukutra se koristi i za `ScrollBar` widget koji se onda preko varijable tipa `struct:$ScrollbarState` može povezati sa `List` widgetom i na taj način omogućiti scrollanje liste za slučaj da je ukupan broj elemenata liste veći od broja elemenata koji stanu unutar `List` widgeta. Više o sistemskoj strukturi `struct:$ScrollbarState` možete saznati u dokumentaciji za `ScrollBar` widget.

## Default style [DRAFT]

Ovaj style se koristi prilikom renderiranja pozadine widgeta.

## Item widget [EMPTY]

## List type [DRAFT]

Pomoću ovog propertija se bira vertikalna ili horizontalna orijentacija.

## Gap [DRAFT]

Razmak u pikselima između dva elementa grida.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
-   CSV
-   JSON
-   MQTT
-   Simple HTTP
-   Charts
-   Regexp String
-   Multi-Language
