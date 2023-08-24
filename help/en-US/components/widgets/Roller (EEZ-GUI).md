# DESCRIPTION

Roller vam omogućuje da odaberete jednu opciju s popisa koristeći touch based scrolling.

# PROPERTIES

## Data

Varijabla u koju se sprema odabrana vrijednost u rasponu od `[Min, Max]`.

## Default style

Style koji se koristi za renderiranje pozadine.

## Min

Minimalna vrijednost koja se može odabrati.

## Max

Maksimalna vrijednost koja se može odabrati.

## Text

Text koji se prikazuje u widgetu za svaku moguću vrijednost koja se odabira.

Primjer: postavite Data na `selected_option` (tipa `integer`), postavite Min na `0`, a Max na `Array.length(TEXTS) - 1`, gdje je `TEXTS` varijabla tipa `array:string` sa `Default value` postavljeno na: `["Option 1", "Option 2", "Option 3", ...]` i onda ovaj property možete postaviti na `TEXTS[selected_option]`.

## Selected value style

Style koji se koristi za renderiranje selektirane vrijednosti.

## Unselected value style

Style koji se koristi za renderiranje ostalih (neselektiranih) vrijednosti.

# INPUTS

## clear [DRAFT]

Pošaljite signal na ovaj input ako želite resetirati odabir, tj. odabrati prvu opciju.

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
