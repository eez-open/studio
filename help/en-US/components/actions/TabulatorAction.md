# DESCRIPTION

Executes an action on the given tabulator widget.

# PROPERTIES

## Widget

Reference to the Tabulator widget. See `Output widget handle` property to find out how to obtain this reference.

## Tabulator action

Action to be executed. It can be "Get sheet data" or "Download".

## Lookup

If Tabulator action is "Get sheet data" then this is the sheet name you want to retrieve, if empty it will retrieve the currently active sheet.

## File name

If Tabulator action is "Download" then this is default download file name.

## Download type

If Tabulator action is "Download" then this is type of file you want to download. Available options are: "CSV", "JSON" or "HTML".

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

-   _Tabulator Examples_
