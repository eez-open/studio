# DESCRIPTION [DRAFT]

Ovaj widget služi za grupiranje više widgeta, a koristi se kada se želi dodatno organizirati stranica koja sadrži puno widgeta ili ako se želi obaviti neke operacija nad više widgeta odjednom npr. sakriti koristeći Visible property od containera. Kada se widget nalazi unutar containera onda njegove left i top koordinate su relativne u odnosu na left i top od containera, znači kada se pomiče container onda se pomiču i widgeti koji se nalaze unutar njega. Widgeti se dodaju u Container preko Widgets Structure panela koristeći drag and drop.

# PROPERTIES

## Default style [DRAFT]

Ovaj style se koristi prilikom renderiranja pozadine widgeta.

## Name [DRAFT]

Opcionalni naziv koji se prikazuje u Widgets Structure panelu u editoru. Ako nije zadan onda se prikazuje "Container".

## Widgets [EMPTY]


## Overlay [EMPTY]


## Shadow [EMPTY]


## Layout [DRAFT]

Ovaj property definira kako se child widgeti pozicioniraju unutar ovog containera:

-   `Static`: child widgeti se unutar containera pozicioniraju koristeći njihove left i top propertije.
-   `Horizontal`: child widgeti se pozicioniraju od lijeva prema desno (ili obrnuto ako je odabrano RTL u SetPageDirection akciji) i to redom prema poretku koji je postavlje kroz Widgets Structure panel. Znači, ako je ova opcija odabrana onda se left property od child widgeta ne koristi. Ako je neki child widget hidden, onda se on preskače i njegovu poziciju zauzima slijedeći visible widget u poretku.
-   `Vertical`: child widgeti se pozicioniraju od gore prema dolje i to redom prema poretku koji je postavlje kroz Widgets Structure panel. Znači, ako je ova opcija odabrana onda se top property od child widgeta ne koristi. Ako je neki child widget hidden, onda se on preskače i njegovu poziciju zauzima slijedeći visible widget u poretku.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
