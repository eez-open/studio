# DESCRIPTION [DRAFT]

Inicira odspajanje sa servera, koje će biti potvrđeno sa `Close` eventom i nakon toga `End` eventom.

# PROPERTIES

## Connection [DRAFT]

MQTT konekcija sa koje se odspajamo.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output. Akcija odmah izlazi na ovaj output, a u pozadini se pokušavamo spojiti na server.

# EXAMPLES [DRAFT]

-   MQTT
