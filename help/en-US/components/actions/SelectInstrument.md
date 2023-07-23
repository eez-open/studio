# DESCRIPTION [DRAFT]

Ova akcija otvara dialog box za odabir instrumenta. Odabrani instrument se šalje na `instrument` output.

Ako je za globalnu instrument object varijablu postavljeno da je `Persistent` (tj. pamti se odabir između dva pokretanja dashboarda) onda već kod pokretanja dashboarda se otvara dialog box za odabir instrumenta i onda nije potrebno koristiti ovu akciju. Ali ako ne želimo da se odabir automatski otvara kod pokretanja, onda za globalnu instrument varijablu ne smijemo enejblati `Persistent` checkbox i možemo koristiti ovu akciju kasnije kako bi se odabrao instrument.

![Alt text](../images/select_instrument_persistent_checkbox.png)

# PROPERTIES

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## instrument [DRAFT]

Output na koji se šalje odabrani instrument.

# EXAMPLES [EMPTY]
