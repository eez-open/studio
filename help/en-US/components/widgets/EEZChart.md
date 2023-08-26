# DESCRIPTION [DRAFT]

Prikazuje line chart koristeći isti widget kao i u Instrument History panelu.

# PROPERTIES

## Data [EMPTY]

## Default style

Style used when rendering of the Widget.

## Chart mode [DRAFT]

Postoje ove opcije:

-   `Single chart`: Prikazuje single chart.
-   `Multiple charts`: Prikazuje multiple charts.
-   `EEZ DLOG`: Prikazuje chart zadan preko EEZ DLOG file formata.
-   `Instrument History Item`: Prikazuje chart iz instrument historija.

## Chart data [DRAFT]

Ako je `Chart mode` postavljen na `Single chart` onda ovdje treba postaviti string, array ili blob containing the samples that will be displayed in the chart. Ako je `Chart mode` postavljen na `EEZ DLOG` onda ovdje treba postaviti sadržaj EEZ DLOG fajla (npr. može se pročitati sa FileRead akcijom, pogledati `EEZ Chart` primjer).

This property is not used when the `Chart mode` is `Multiple charts` or `Instrument History item`.

## Format [DRAFT]

Format of `Data` property. Possible values:

-   `"float"`: "Chart data" must be a blob containing 32-bit, little-endian float numbers, or `array:float`
-   `"double"`: "Chart data" must be a blob containing 64-bit, little-endian float numbers, or `array:float`
-   `"rigol-byte"`: "Chart data" must be a blob containing 8-bit unsigned integer numbers
-   `"rigol-word"`: "Chart data" must be a blob containing 16-bit unsigned integer numbers
-   `"csv"`: "Chart data" must be a CSV string, the first column is taken

This property is only used when the `Chart mode` is `Single chart`.

## Sampling rate [DRAFT]

Sampling rate or number of samples per second (SPS).

This property is only used when the `Chart mode` is `Single chart`.

## Unit name [DRAFT]

The unit displayed on the Y-axis. The X-axis is always time.

This property is only used when the `Chart mode` is `Single chart`.

## Color [DRAFT]

The color of the line in the chart.

This property is only used when the `Chart mode` is `Single chart`.

## Label [DRAFT]

Chart label:

![Alt text](../images/add_to_instrument_history_label.png)

This property is only used when the `Chart mode` is `Single chart`.

## Offset [DRAFT]

Offset value used in formula `offset + sample_value * scale` which transforms sample value to sample position on y axis in the chart.

This property is only used when the `Chart mode` is `Single chart`.

## Scale [DRAFT]

When displaying samples, the formula `offset + sample_value * scale` is used.

This property is only used when the `Chart mode` is `Single chart`.

## Charts [DRAFT]

List chart definicija kada je `Chart mode` postavljen na `Multiple charts`. Svaka definicija sadrži ove propertije:

-   `Chart data`
-   `Format`
-   `Sampling rate`
-   `Unit`
-   `Color`
-   `Label`
-   `Offset`
-   `Scale`

Koji imaju isto značenje kao i pripadajući propertiji kada je odabran `Single chart` mode.

## History item ID [DRAFT]

This ID is obtained using `AddToInstrumentHistory` action through `id` output of that action.

This property is only used when the `Chart mode` is `Instrument History Item`.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _Line Chart_
-   _EEZ Chart_
-   _Rigol Waveform Data_
