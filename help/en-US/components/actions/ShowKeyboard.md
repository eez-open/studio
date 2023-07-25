# DESCRIPTION [DRAFT]

Otvara keyboard page za unos teksta. Keyboard page se mora nalaziti u projektu i mora imati ID 2. Isti Keyboard page također otvara i Input widget.

Pogledati example "Keyboard, Keypad and Message Box" za primjer kako je definiran keyboard page:

![Alt text](../images/show_keyboard.png)

# PROPERTIES

## Label [DRAFT]

Labela koja se prikazuje u keyboard stranici.

## Inital text [DRAFT]

Početni tekst koji se uređuje.

## Min chars [DRAFT]

Minimalni broj znakova koji mora imati uneseni tekst.

## Max chars [DRAFT]

Maksimalni broj znakova koji može imati uneseni tekst.

## Password [DRAFT]

Da li se unosi password. Ako se unosi password onda će svaki znak tijekom unosa biti zamjenjen sa `*`.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## result [DRAFT]

Output na koji se šalje unešeni tekst.

## canceled [DRAFT]

Output na koji se izlazi ako se pritisne cancel button.

# EXAMPLES [DRAFT]

-   Keyboard, Keypad and Message Box
-   stm32f469i-disco-eez-flow-demo
