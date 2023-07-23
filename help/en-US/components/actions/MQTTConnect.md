# DESCRIPTION [DRAFT]

Inicira spajanje na MQTT server, ako je spajanje uspješno biti će emitiran Connect event, odnosno Error event ako je došlo do greške. Ako je došlo do greške ili se jednom uspostavljena konekcija prekinula biti će pokušan periodično reconnect dok se konekcija ponovno ne uspostavi, što će biti javljeno sa emitiranim Reconnect eventom. Sve ovo se dešava asinkrono u pozadini, sve dok se ne pozove MQTTDisconnect, a svaka promjena stanja biti će javljena sa eventom koji se može obraditi kroz MQTTEvent akciju.

# PROPERTIES

## Connection [DRAFT]

MQTT konekcija na koju se spajamo.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output. Akcija odmah izlazi na ovaj output, a u pozadini se pokušavamo odspojiti na server.

# EXAMPLES [DRAFT]

-   MQTT
