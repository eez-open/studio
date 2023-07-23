# DESCRIPTION [DRAFT]

Pomoću ove akcije možemo dodati novi item u history view od instrumenta. Trenutno, samo chart item možemo dodati, ali u budućnosti će biti podržani i drugi itemi, kao npr. screenshot.

Npr. u Rigol Waveform Data exampleu imamo ovu akciju:

![Alt text](../images/add_to_instrument_history_action.png)

Koja će dodati chart u history i tamo će taj chart izgledati ovako:

![Alt text](../images/add_to_instrument_history_history.png)

# PROPERTIES

## Instrument [DRAFT]

Instrument u čiji history dodajemo.

## Item type [DRAFT]

Item type, trenutno to može biti samo "Chart".

## Chart description [DRAFT]

Opis charta koji se prikazuje u historiju instrumenta:

![Alt text](../images/add_to_instrument_history_description.png)

## Chart data [DRAFT]

Ovo je string ili blob u kojem se nalaze samplovi.

## Chart sampling rate [DRAFT]

Sampling rate, odnosno broj samplova u sekundi.

## Chart offset [DRAFT]

Kod prikaza sampla se koristi formula `offset + sample_value * scale`.

## Chart scale [DRAFT]

Kod prikaza sampla se koristi formula `offset + sample_value * scale`.

## Chart format [DRAFT]

Format od `Chart data`. Moguće vrijednosti:

-   `"float"`: "Chart data" mora biti blob u kojem se nalaze 32-bit, little-endian float brojevi
-   `"double"`: "Chart data" mora biti blob u kojem se nalaze 64-bit, little-endian float brojevi
-   `"rigol-byte"`: "Chart data" mora biti blob u kojem su nalazi 8-bitni unsigned integer brojevi
-   `"rigol-word"`: "Chart data" mora biti blob u kojem su nalazi 16-bitni unsigned integer brojevi
-   `"csv"`: "Chart data" mora biti CSV string, uzima se prva kolona

## Chart unit [DRAFT]

Unit koji se prikazuje na Y osi. X os je uvijek vrijeme.

## Chart color [DRAFT]

Boja linije u chartu ako je selektiran dark backround.

## Chart color inverse [DRAFT]

Boja linije u chartu ako je selektiran light backround.

## Chart label [DRAFT]

Labela charta:

![Alt text](../images/add_to_instrument_history_label.png)

## Chart major subdivision horizontal [DRAFT]

![Alt text](../images/add_to_instrument_history_major_subdivision_horizontal.png)

## Chart major subdivision vertical [DRAFT]

![Alt text](../images/add_to_instrument_history_major_subdivision_vertical.png)

## Chart minor subdivision horizontal [DRAFT]

![Alt text](../images/add_to_instrument_history_minor_subdivision_horizontal.png)

## Chart minor subdivision vertical [DRAFT]

![Alt text](../images/add_to_instrument_history_minor_subdivision_vertical.png)

## Chart horizontal scale [DRAFT]

Broj koji definira zoom faktor X osi u default prikazu charta.

## Chart vertical scale [DRAFT]

Broj koji definira zoom faktor Y osi u default prikazu charta.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS [DRAFT]

A standard sequence output.

## seqout [DRAFT]

## id [DRAFT]

ID od dodanog history itema. Ovaj podatak možemo npr. koristiti u EEZ Chart widgetu da chart history item prikažemo i unutar dashboarda.

# EXAMPLES [DRAFT]

-   Rigol Waveform Data
