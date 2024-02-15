# DESCRIPTION

This action is used to send Modbus commands to the Modbus server. If coils are read, then the read value will be passed through output `values` as a value of type `array:boolean`, and in the case of registers, then a value of type `array:integer` will be passed through output `values`.

# PROPERTIES

## Connection

Serial connection used to send Modbus commands.

## Server address

A number between 0 and 255 used to select the Modbus server on the serial connection.

## Command

Command to be sent:

-   01 (0x01) Read Coils
-   02 (0x02) Read Discrete Inputs
-   03 (0x03) Read Holding Registers
-   04 (0x04) Read Input Registers
-   05 (0x05) Write Single Coil
-   06 (0x06) Write Single Register
-   15 (0x0F) Write Multiple Coils
-   16 (0x10) Write Multiple Registers

## Register address

Register address for single write: 05 (0x05) Write Single Coil or 06 (0x06) Write Single Register.

## Starting register address

The address of the first register for multiple read and write.

## Quantity of registers

The register number for multiple read and write.

## Coil value

Coil value (`boolean`) that is sent during a single write (i.e. when 05 (0x05) Write Single Coil is used).

## Register value

Register value (`integer`) that is sent during a single write (i.e. when 06 (0x06) Write Single Register is used).

## Coil values

Coil values (of type `array:boolean`) when multiple writes are performing.

## Register values

Registar values (of type `array:integer`) when multiple writes are performing.

## Timeout (ms)

Maximum waiting time for server response. It is set in milliseconds.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES [EMPTY]
