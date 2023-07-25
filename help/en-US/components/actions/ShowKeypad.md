# DESCRIPTION [DRAFT]

Otvara numeric keypad page za unos broja. Numeric keypad page se mora nalaziti u projektu i mora imati ID 2. Isti Keypad page također otvara i Input widget.

Pogledati example "Keyboard, Keypad and Message Box" za primjer kako je definiran keypad page:

![Alt text](../images/show_keypad.png)

# PROPERTIES

## Label [DRAFT]

Labela koja se prikazuje u numeric keypad stranici.

## Inital value [DRAFT]

Početni broj koji se uređuje.

## Min [DRAFT]

Unešeni broj mora biti veći ili jednak ovom broju.

## Max [DRAFT]

Unešeni broj mora biti manji ili jednak ovom broju.

## Precision [DRAFT]

Unešeni broj se zaokružuje na ovu preciznost. Npr. ako se želi maksimalno dvije decimalne znamenke onda ovdje treba zadati `0.01`.

## Unit [DRAFT]

Unit koji se prikazuje kod unosa.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## result [DRAFT]

Output na koji se šalje unešeni broj.

## canceled [DRAFT]

Output na koji se izlazi ako se pritisne cancel button.

# EXAMPLES [DRAFT]

-   stm32f469i-disco-eez-flow-demo
-   Keyboard, Keypad and Message Box
