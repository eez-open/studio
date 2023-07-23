# DESCRIPTION [DRAFT]

Ova akcija inicira asinkrono odspajanje sa instrumenta, tj. akcija neće čekati da se odspojimo sa instrumenta prije nego što izađe na `seqout`, nego izlazi odmah. Da li smo se odspojili možemo provjeriti sa `instrument_variable.isConnected`. Npr. možemo unutar Watch akcije pratiti ovaj expressiona kako bi smo ulovili trenutak kada smo se odspojili sa instrumenta.

# PROPERTIES

## Instrument [DRAFT]

Instrument objekt sa kojeg se odspajamo.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [EMPTY]
