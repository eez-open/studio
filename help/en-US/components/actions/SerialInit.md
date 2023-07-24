# DESCRIPTION [DRAFT]

Kreira i inicijalizira Serial connection object sa konekcijskim parametrima koji se definiraju kroz propertije. Ovu akciju je potrebno prvu izvršiti, a nakon nje treba pozvati SerialConnect akciju.

# PROPERTIES

## Connection [DRAFT]

Connection object tipa `object:SerialConnection` koji se kreira i inicijalizira.

## Port [DRAFT]

Path of the serial port.

## Baud rate [DRAFT]

Port's baud rate.

## Data bits [DRAFT]

Port's data bits. Possible values: 5, 6, 7, 8.

## Stop bits [DRAFT]

Port's stop bits. Possible values: 1, 2

## Parity [DRAFT]

Port's parity. Possible values: "none", "even", "mark", "odd", "space"

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

A standard sequence output.

## seqout [DRAFT]

# EXAMPLES [EMPTY]
