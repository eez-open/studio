# DESCRIPTION [DRAFT]

Kreira i inicijalizira MQTT connection object sa konekcijskim parametrima koji se definiraju kroz propertije. Ovu akciju je potrebno prvu izvršiti, a nakon nje treba pozvati MQTTEvent akciju.

# PROPERTIES

## Connection [DRAFT]

Connection object tipa `object:MQTTConnection` koji se kreira i inicijalizira.

## Protocol [DRAFT]

Protokol koji se koristi. Moguće vrijednosti su `"mqtt"` ili `"mqtts"` (ovo je secure varijanta).

## Host [DRAFT]

Naziv server na koji se spajamo.

## Port [DRAFT]

Port na koji se spajamo. Default je 1883.

## User name [DRAFT]

Korisničko ime. Može se ostaviti prazno ako se ne koristi.

## Password [DRAFT]

Korisnički password. Može se ostaviti prazno ako se ne koristi.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [DRAFT]

-   MQTT
