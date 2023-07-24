# DESCRIPTION [DRAFT]

Ova akcija pokreće python skriptu i šalje handle pokrenute skripte na `handle` output. Taj handle se koristi u `PythonEnd` akcije ako se želi zaustaviti pokrenuta Python skripta ili u `PythonSendMessage` akciji ako se želi poslati message od Flowa prema Python skripti, a potreban je zato što u nekom trenutku može biti pokrenuto više skripti i preko tog handlea se targetira pokrenuta skripta.

# PROPERTIES

## Script source option [DRAFT]

Postoje tri opcije kako se može zadati source od python scripte:

-   Inline script
-   Inline script as expression
-   Script file

## Inline script [DRAFT]

Ako se za `Script source option` odabralo `Inline script` onda ovdje treba unjeti source code skripte.

## Inline script as expression [DRAFT]

Ako se za `Script source option` odabralo `Inline script as expression` onda ovdje treba unjeti expression koji kada se evaluira dobije se string koji sadrži source code skripte.

## Script file [DRAFT]

Ako se za `Script source option` odabralo `Script file` onda ovdje treba unjeti file path do `.py` fajla.

## Python path [DRAFT]

Puni path do python komande. Ako se python komanda već nalazi u sistemskom pathu onda se može postaviti na prazan string, tj. `""`.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## handle [DRAFT]

Kroz ovaj output se vraća hanle za pokrenutu skriptu koji se koristi u `PythonEnd` i `PythonSendMessage` akcijama.

## message [DRAFT]

Kroz ovaj output će biti poslano sve što se printa na stdout unutar pokrenute Python skripte. Na ovaj način python skripta šalje message prema Flowu, a ako Flow želi poslati message Python skripti onda treba koristiti PythonSendMessage akciju.

# EXAMPLES [DRAFT]

    - Charts
