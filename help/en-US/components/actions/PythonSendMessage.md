# DESCRIPTION [DRAFT]

Ova akcija šalje poruku od Flowa prema pokrenutoj Python skripti.

# PROPERTIES

## Handle [DRAFT]

Ovo je handle koji se dobio prilikom izvršavanja PythonRun akcija a služi za targetiranje kojoj skriptu želimo poslati message budući da u nekom trenutku može biti pokrenuto više skripti.

## Message [DRAFT]

Message koji se šalje.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

## handle [DRAFT]

Handle se može predati i preko ovog inputa. A ako se handle dobija na neki drugi način, npr. iz varijable preko `Handle` propertija, onda se ovaj input može obrisati u "Flow - Inputs" sekciji.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [DRAFT]

    - Charts
