# DESCRIPTION

Retrieves the list of serial ports detected on the system and sends it through `ports` output.

# PROPERTIES

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## ports

A list of ports is sent to this output as a value of type `array:$SerialPort`. The system structure `$SerialPort` has these members:

- `manufacturer`: _string_. The name of the manufacturer of the device connected to the port.
- `serialNumber`: _string_. Port serial number.
- `path`: _string_. Path of the serial port, which is used in the _SerialInit_ Action.

# EXAMPLES [EMPTY]
