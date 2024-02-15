# DESCRIPTION

Displays the system file save dialog and sends the set file path to the `file_path` output.

# PROPERTIES

## File name

The file name to be used by default.

## Filters

If we want to limit which types of files appear inside the file save dialog, then we can specify the filter list as `array:string`, for example `["PNG Images|png", "JPG Images|jpg", "GIF Images|gif"] `. This is an optional property and if it is not set then all files will be displayed.

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
