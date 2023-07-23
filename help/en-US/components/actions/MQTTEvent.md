# DESCRIPTION [DRAFT]

S ovom akcijem možemo dodati jedan ili više event handlera koji se mogu primiti od strane MQTT konekcije. Nakon što se izvrši ova akcija može se pozvati MQTTConnect akcija.

# PROPERTIES

## Connection [DRAFT]

MQTT konekcija čije evente žalimo handlati.

## Event handlers [DRAFT]

List evenata koje želimo handlati. Za svaki item u listi moramo odabrati `Event`, `Handler type` i opcionalno `Action`. `Event` je vrsta eventa koji želimo handlati i moguće vrijednosti su:

-   `Connect`. Emitira se u slučaju uspješnog spajana ili ponovnog spajanja (reconnect).
-   `Reconnect`. Emitira se kada se pokušava ponovno spojiti nakon što je konekcija disconnectana.
-   `Close`. Emitira se nakon što je konekcija disconnectana.
-   `Disconnect`. Emitira se kada se primi disconnect packet od strane brokera.
-   `Offline`. Emitira se kada klijent otiđe offline.
-   `End`. Emitira se kada se izvrši MQTTDisconnect akcija.
-   `Error`. Emitira se kada se klijent ne može spojiti ili je došlo do parsing greške.
-   `Message`. Emitira se kada klijent primit publishani packet od strane servera za topic na koji smo se prethodno predbilježili sa MQTTSubscribe akcijom. Kroz output se šalje podatak tipa `struct:$MQTTMessage`, radi se o sistemskoj strukturi koja ima ove membere:

    -   `topic`: Naziv topica za koji je packet publishan.
    -   `payload`: Sadržaj poruke koja je pristigla.

`Handler type` može biti `Flow` ili `Action`. Ako se odabere `Flow` onda će biti dodan output kroz koji se izlazi ako je event emitiran. A ako se odabere `Action` onda je potrebno još postaviti i `Action`, tj. naziv user akcije koja se izvršava kad dođe event.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES

-   MQTT
