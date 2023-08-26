# DESCRIPTION [DRAFT]

This Widget displays a bitmap. Ako se zna unaprijed koja bitmapa se želi prikazati onda je potrebno koristiti `Bitmap` property gdje se odabir naziva bitmape, a ako je bitmapa poznata tek tijekom izvršavanja, jer npr. dolazi iz neke varijable, onda je potrebno koristiti Data property.

# PROPERTIES

## Data [DRAFT]

Ovdje imamo više opcija kako odabrati bitmapu koju treba prikazati:

-   Ako je zadana vrijednost tipa `integer` onda je to index of the bitmap to be displayed. It is necessary to use the functions `Flow.getBitmapIndex({<bitmapName>})`, which receives `bitmapName`, i.e. the name of the bitmap, and returns the index of the bitmap. In this way, we can choose or change which bitmap will be displayed in the runtime, because, for example, `bitmapName' can come from a variable.

-   Ako je zadana vrijednost tipa `string` onda se podrazumjeva da je bitmapa enkodirana po pravilima [Data URI Scheme](https://en.wikipedia.org/wiki/Data_URI_scheme).

-   Ako je zadana vrijednost tipa `blob` onda je bitmapa zadana u svom binarnom zapisu (vidjeti Screen Capture example).

## Default style

Style used when rendering the background of the Widget.

## Bitmap

The name of the bitmap to be displayed.

## Custom ui [EMPTY]


# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Dashboard Widgets Demo_
-   _Screen Capture_
