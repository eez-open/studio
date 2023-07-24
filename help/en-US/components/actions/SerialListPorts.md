# DESCRIPTION [DRAFT]

Ova akcija dohvaća listu serial portova koji postoje na sistemu i šalje je kroz `ports` output.

# PROPERTIES

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## ports [DRAFT]

List portova se šalje na ovaj output kao vrijednost tipa `array:$SerialPort`. Sistemska struktura `$SerialPort` ima ove membere:

-   `manufacturer`: _string_. Naziv proizvođača uređaja priključenog na port.
-   `serialNumber`: _string_. Serijski broj porta.
-   `path`: _string_. Path of the serial port, koji se koristi u SerialInit akciji.

# EXAMPLES [EMPTY]
