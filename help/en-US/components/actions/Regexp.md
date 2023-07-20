# DESCRIPTION [DRAFT]

Pretražuje, zadani string ili stream, koristeći pattern napisan prema pravilima regular expression sintakse.

# PROPERTIES

## Pattern [DRAFT]

Regular expression koji se koristi za pretraživanje.

## Text [DRAFT]

Text koji se pretražuje, može biti string ili stream.

## Global [DRAFT]

Opcija s kojem se bira da li se traži samo prvi pojavljivanje patterna ili svako pojavljivanje patterne.

## Case insensitive [DRAFT]

Opcija s kojom se bira da li je pretraživanje case sensitive ili insensitive?

# INPUTS

## seqin [DRAFT]

A standard sequence input. Na ovaj input je potrebno ući jednom na početku.

## next [DRAFT]

Kroz ovaj input je potrebno ući kada se želi dobiti slijedeći match.

## stop [DRAFT]

Kroz ovaj input je potrebno ući kada se želi prekinuti daljnje pretraživanje - nakon čega se odmah izlazi na `done` output.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## match [DRAFT]

Kroz ovaj output se šalje match u obliku `struct:$RegexpMatch` vrijednosti.

`$RegexpMatch` struktura ima ove fieldove:

-   `index` (`integer`) - The 0-based index of the match in the string.
-   `texts` (`array:string`) - The array that has the matched text as the first item, and then one item for each [capturing group](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences) of the matched text.
-   `indices` (`array:array:integer`) - It is an array where each entry represents the bounds of a substring match. The index of each element in this array corresponds to the index of the respective substring match in the `texts` array. In other words, the first indices entry represents the entire match, the second indices entry represents the first capturing group, etc. Each entry itself is a two-element array, where the first number represents the match's start index, and the second number, its end index.

## done [DRAFT]

Kroz ovaj output se izlazi kada je pretraživanje završeno, tj. više ne postoji niti jedan match.

# EXAMPLES [DRAFT]

    - RegExp String
    - RegExp Stream
