# DESCRIPTION [DRAFT]

Ova akcija služi za obradu eventa koji se može emitirati unutar stranice u kojoj se akcija nalazi.

# PROPERTIES

## Event [DRAFT]

Event koji se obrađuje. Postoje ovi page eventi:

-   Page open

    Ovaj event se emitira kad stranica postane aktivna, npr. kada se prikaže sa `ShowPage` akcijom.

-   Page close

    Ovaj event se emitira kad stranica postane neaktivna.

-   Keydown

    Ovaj event se emitira kad se pritisne tipka na tipkovnici. Na `event` output se šalje string sa [nazivom tipke](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values).

# INPUTS [EMPTY]

# OUTPUTS

## seqout [DRAFT]

A standard sequence output. Kroz ovaj output se izlazi kada je odabrani event emitiran.

## event [DRAFT]

Kroz ovaj output se šalje dodatna informacija (ako takva postoji) za emitirani event. Page open i Page close eventi ne šalju ništa kroz ovaj event, a Keydown event šalje string sa [nazivom tipke](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)

# EXAMPLES [DRAFT]

-   Tetris
