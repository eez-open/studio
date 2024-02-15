# DESCRIPTION [DRAFT]

Ova akcija služi za slanje Modbus komandi prema Modbus serveru. Ako se čitaju coilsi onda će se kroz output `values` proslijediti pročitane vrijednost kao vrijednost tipa `array:boolean`, a u slučaju registara onda će se kroz output `values` proslijedioti vrijednost tipa `array:integer`.

# PROPERTIES

## Connection [DRAFT]

Serial konekcija preko koje se šalju Modbus komande.

## Server address [DRAFT]

Broj između 0 i 255 s kojim se bira Modbus server na serial konekciji.

## Command [DRAFT]

Komanda koja se šalje:

-   01 (0x01) Read Coils
-   02 (0x02) Read Discrete Inputs
-   03 (0x03) Read Holding Registers
-   04 (0x04) Read Input Registers
-   05 (0x05) Write Single Coil
-   06 (0x06) Write Single Register
-   15 (0x0F) Write Multiple Coils
-   16 (0x10) Write Multiple Registers

## Register address [DRAFT]

Adresa registra kod pojedinačnog write (05 (0x05) Write Single Coil ili 06 (0x06) Write Single Register).

## Starting register address [DRAFT]

Adresa prvog registra kod višestrukog read ili write.

## Quantity of registers [DRAFT]

Broj registara kod višestrukog read ili write.

## Coil value [DRAFT]

Coil vrijednost (`boolean`) koja se šalje kod pojedinačnog write (05 (0x05) Write Single Coil).

## Register value [DRAFT]

Register vrijednost (`integer`) koja se šalje kod pojedinačnog write (06 (0x06) Write Single Register).

## Coil values [DRAFT]

Coil vrijednosti (tipa `array:boolean`) kod višestrukog write.

## Register values [DRAFT]

Registar vrijednosti (tipa `array:integer`) kod višestrukog write.

## Timeout (ms) [DRAFT]

Definira koliko dugo se čeka na odgovor servera, zadaje se u milisekundama.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
