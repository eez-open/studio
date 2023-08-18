# DESCRIPTION [DRAFT]

Ovaj widget, slično kao Container, pod sobom ima više child widgeta. Ali za razliku od Containera koji će uvijek prikazati sve child widgete, ovaj widget prikazuje samo jedan child widget i to onaj koji smo selektirali preko `Data` propertija. Dakle, koristite ovaj widget kada želite u ovisnosti o npr. vrijednosti neke varijable mijenjati strukturu stranice. Widgeti se dodaje u Select preko Widgets Structure panela koristeći drag and drop.

# PROPERTIES

## Data [DRAFT]

Rezultat evaluacije ovog expressiona mora biti zero based index od widgeta koji se želi prikazati. Znači ako je rezultat 0 onda će se prikazati prvi widget, ako je rezultat 1 onda će se prikazati drugi widget, itd. Poredak widgeta se može odabrati koristeći drag and drop unutar Widgets Structure panela.

## Default style [DRAFT]

Ovaj style se koristi prilikom renderiranja pozadine Select widgeta.

## Widgets [EMPTY]

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [DRAFT]

-   eez-gui-widgets-demo
