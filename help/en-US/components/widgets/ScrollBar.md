# DESCRIPTION [DRAFT]

Ovo je ScrollBar widget koji se može koristiti uz List/Grid widget za pomicanje unutar velikih lista koji ne stanu čitave unutar List/Grid widgeta. Ako je width > height onda se prikazuje horizontalni ScrollBar:

![Alt text](scrollbar.png)

a ako je width <= height onda se prikazuje vertikalni ScrollBar.

![Alt text](scrollbar_vert.png)

Horizontalni ScrollBar ima left i right buttone, a vertikalni top i bottom buttone.

Ovaj widget se povezuje sa List/Grid widgetom preko varijable tipa `struct:$ScrollbarState` koja se zadaje u `Data` propertiju. Strukutra `struct:$ScrollbarState` ima ova polja:

-   `numItems` - koliko itema/elementa se nalazi u listi
-   `itemsPerPage` - koliko itema stane unutar List/Grid widgeta.
-   `positionIncrement` - za koliko itema ćemo se pomaknuti unutar liste kada se pritisne na left/top button (pomak u lijevo/gore) ili right/bottom button (pomak u desno/dolje).
-   `position` - pozicija prvog itema/elementa koji se renderira u listi. Znači unutar Liste/Grida će se renderirati itemi od `position` do `position + itemsPerPage`. `position` može biti u intervalu od 0 do `numItems - itemsPerPage`.

Na ovaj način scrollbar može mijenjati `position`:

-   Pritiskom na Left/Top button `position` se umanjuje za `positionIncrement` vrijednost.
-   Pritiskom na Right/Bottom button `position` se uvećava za `positionIncrement` vrijednost.
-   Pomicanjem thuma `position` se postavlja na vrijednost u intervalu od 0 do `numItems - itemsPerPage`.
-   Ako se pritisne u regiji između Left/Top buttona i Thumba onda se position umanjuje za `itemsPerPage` (AKA "page up").
-   Ako se pritisne u regiji između Thumba i Right/Bottom buttona onda se position uvećava za `itemsPerPage` (AKA "page down").

# PROPERTIES

## Data [DRAFT]

Ovdje treba staviti naziv varijable tipa `struct:$ScrollbarState`.

## Default style [DRAFT]

Ovaj style se koristi prilikom renderiranja pozadine.

## Thumb style [DRAFT]

Ovaj style se koristi prilikom renderiranja thumba.

## Buttons style [DRAFT]

Ovaj style se koristi prilikom renderiranja lijevog i desnog buttona.

## Left button text [DRAFT]

Ovo je tekst koji se prikazuje unutar left/top buttona. Obično se koristiti single character iz nekog icons fonta.

## Right button text [DRAFT]

Ovo je tekst koji se prikazuje unutar right/bottom buttona. Obično se koristiti single character iz nekog icons fonta.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
