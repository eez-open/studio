# DESCRIPTION [DRAFT]

Ova akcija se koristi za prekidanje izvršavanja flowa.

Ako se ova akcija nalazi unutar stranice to znači kraj izvršavanja aplikacije. Ako je riječ o dashboard projektu koji se izvršava unutar project editora, to znači prelazak iz Run moda u Edit mode. Ako je riječ o dashboardu koji se izvršava na instrumentu, izvršavanje će biti prekinuto i pojaviti će se Start button s kojim se Dasboard može ponovno pokrenuti. Ako je riječ o Dashboardu kao standalone aplikaciji onda će aplikacija biti ugašena.

Ako se ova akcija nalazi unutar User akcije to znači kraj izvršavanja user akcije i aktiviranje standardne sequence linije na mjestu gdje je user akcija pozvana.

Ova akcija nema efekta ako se nalazi unutar user widget flowa.

# PROPERTIES

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

# EXAMPLES [EMPTY]


