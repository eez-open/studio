# DESCRIPTION

Displays the system file save dialog and sends the set file path to the `file_path` output.

# PROPERTIES

## File name

The file name to be used by default.

## Filters [DRAFT]

Ako se želi ograničiti koji vrste fajlova se pojavljuju unutar file save dialoga onda se može zadati lista filtera kao `array:string`, npr. `["PNG Images|png", "JPG Images|jpg", "GIF Images|gif"]`. Ovo je opcionalni property i ako se ne zada onda će se prikazati svi fajlovi.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## file_path

Output to which the set file path is sent.

# EXAMPLES

-   _Screen Capture_
