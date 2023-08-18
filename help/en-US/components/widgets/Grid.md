# DESCRIPTION

Koristite ovaj widget kada želite isti widget prikazati više puta, tj. multiplicirati, unutar grida. Ovaj widget pod sobom ima jedan child widget, a koliko puta će se on prikazati ovisi o `Data` propertiju. Multiplicirani widgeti ovisno o `Grid flow` propertiju mogu biti prikazani tako da se prvo popunjavaju redci:

![Alt text](../images/grid_row_flow.png)

ili stupci:

![Alt text](../images/grid_column_flow.png)

Ne bi bilo previše korisno kada bi multiplicirani widgeti uvijek imali isti sadržaj, zato postoji sistemska varijabla `$index` koja nam govori koji po redu widget se renderira. Ta varijabla je zero based, znači kada je njena vrijednost 0 onda se renderira prvi widget, kada je njena vrijednost 1 onda se renderira drugi widget, itd. Taj `$index` se onda može koristiti unutar expressiona od propertija od child widgeta i na taj način se postiže da svaki renderirani widget ima drugačiji sadržaj (npr. gornje slike su nastale tako da smo za Text widget definirali da se prikazuje tekst izračunat iz ovog expressiona: `"Widget #" + $index`).

# PROPERTIES

## Data

O ovom propertiju ovisi koliko će se puta child widget multiplicirati, tj. broj elemenata u gridu. Vrijednost ovog propertija može biti integer i onda je to broj elemenata, a ako je vrijednost ovog propertije array onda je broj elemenata u listi jednak broju elemenata u tom arraya.

Posebno, za EEZ-GUI projekte, vrijednost ovog propertija može biti i `struct:$ScrollbarState`. Ista strukutra se koristi i za `ScrollBar` widget koji se onda preko varijable tipa `struct:$ScrollbarState` može povezati sa `Grid` widgetom i na taj način omogućiti scrollanje grida za slučaj da je ukupan broj elemenata grida veći od broja elemenata koji stanu unutar `Grid` widgeta. Više o sistemskoj strukturi `struct:$ScrollbarState` možete saznati u dokumentaciji za `ScrollBar` widget.

## Default style [DRAFT]

Ovaj style se koristi prilikom renderiranja pozadine Grid widgeta.

## Item widget [EMPTY]


## Grid flow [DRAFT]

Pomoću ovog propertija se definira način popunjavanja grida, odaberite `Row` ako želite da se puni redak po redak ili odaberite `Column` ako želite da se puni kolona po kolona.

# INPUTS

# OUTPUTS

# EXAMPLES

    - Tetris
