# DESCRIPTION [DRAFT]

Ovaj widget prikazuje zadanu vrijednost kroz `Data` property kao bar i kao text (ako je odabrano). Također, ako je zadano, prikazati će i dvije linije na zadanim pozicijama (`Threshold1` i `Threshold2`), npr. za označavanje nekih kritičnih vrijednosti.

# PROPERTIES

## Data [DRAFT]

Ovo je vrijednost unutar raspona `[Min, Max]` za koju će se renderirati bar i text.

## Default style [DRAFT]

Style koji se koristi za renderiranje widgeta.

## Orientation [DRAFT]

Definira orijentaciju widgeta, postoje ove opcije:

-   Left right: kako vrijednost zadana kroz `Data` raste od Min do Max, tako i bar unutar grapha raste od lijeve strane prema desnoj strani.
-   Right left: bar raste od desna prema lijevo
-   Top bottom: bar raste od gore prema dolje
-   Bottom top: bar raste od dolje prema gore

## Display value [DRAFT]

Ako je ovo checked prikazati će se i `Data` vrijednost kao tekst.

## Threshold1 [DRAFT]

Ovo je opcionalna vrijednost unutar raspona `[Min, Max]` na čijoj poziciji će se nacrtati linija u zadanom stilu (`Line1 style`). Svrha je označiti neku kritičnu vrijednost unutar bar grapha.

## Threshold2 [DRAFT]

Ovo je opcionalna vrijednost unutar raspona `[Min, Max]` na čijoj poziciji će se nacrtati linija u zadanom stilu (`Line1 style`). Svrha je označiti neku kritičnu vrijednost unutar bar grapha.

## Min [DRAFT]

Minimalna vrijednost koju može imati `Data` vrijednost.

## Max [DRAFT]

Maksimalna vrijednost koju može imati `Data` vrijednost.

## Refresh rate [DRAFT]

Slično kao i u `DisplayData` widgetu, definira kojom brzinom će se osvježavati tekst.

## Text style [DRAFT]

Style koji se koristi za renderiranje teksta unutar widgeta.

## Threshold1 style [DRAFT]

Style koji se koristi za renderiranje Threshold1 vrijednosti.

## Threshold2 style [DRAFT]

Style koji se koristi za renderiranje Threshold2 vrijednosti.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
