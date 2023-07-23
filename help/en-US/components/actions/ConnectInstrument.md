# DESCRIPTION [DRAFT]

Ova akcija inicira asinkrono spajanje na instrument, tj. akcija neće čekati da se spoji na instrument prije nego što izađe na `seqout`, nego izlazi odmah. Da li smo se spojili možemo provjeriti sa `instrument_variable.isConnected`. Npr. možemo unutar Watch akcije pratiti ovaj expressiona kako bi smo ulovili trenutak kada smo se spojili na instrument i možemo mu početi slati SCPI komande.

# PROPERTIES

## Instrument [DRAFT]

Instrument objekt na koji se spajamo.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [EMPTY]
