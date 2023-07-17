# DESCRIPTION [DRAFT]

Evaluira redom expressione (`When`) iz liste `Cases` i kada se naiđe na rezultat koji je true izlazi se na output čije je ime zadano sa `Then output`. Opcionalno, na taj output se proslijeđuje vrijednost dobijenu evaluacijom `With value` izraza, inače se proslijeđuje `true`. Ako niti jedan expression nije true onda neće izaći na niti jedan output. Može se kao zadnji element liste dodati postaviti za `When` expression vrijednost `true`, i u tom slučaju će se uvijek barem na taj output izaći ukoliko niti jedan prethodni expression nije bio true.

# PROPERTIES

## Cases [DRAFT]

Svaki element ove liste sadrži:

-   `When` - expression za koji se provjerava da li je true
-   `Then output` - naziv outputa kroz koji se nastavalja izvršavanje flowa ako je expression `When` true.
-   `With value` - opcionalno se razultat ovog expressiona, ako je zadan, proslijeđuje na output - inače se proslijeđuje `true`.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [EMPTY]
