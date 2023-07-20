# DESCRIPTION [DRAFT]

Ova akcija evaluira JavaScript expression i rezultat šalje kroz `result` output

# PROPERTIES

## Expression [DRAFT]

JavaScript expression koji se evaluira. Unutar njega se se može ubaciti na više mjesta i EEZ FLOW expression, koji se piše unutar vitičastih zagrada. Npr. u JavaScript expressionu `Math.random() * {num_items}`, ovo `{num_items}` je EEZ Flow expression, tj. uzima se vrijednost num_items varijable koja dolazi iz EEZ Flow-a prije nego što se predaja JavaScripti da izračuna ostatak expressiona.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## result [DRAFT]

Output kroz koji se šalje rezultat evaluacije JavaScript expressiona. By default, `Type` outputa je postavljen na `any`, pa je poželjno promjeniti u neki konkretan type.

# EXAMPLES [EMPTY]
