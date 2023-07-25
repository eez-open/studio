# DESCRIPTION

It is used to add a new item to the _History_ view of the instrument. Currently, only adding chart items is supported.

For example in the _Rigol Waveform Data_ example we have this Action:

![Alt text](../images/add_to_instrument_history_action.png)

It is used to add a chart which, after successful addition, will be displayed as follows (example of test signal acquisition):

![Alt text](../images/add_to_instrument_history_history.png)

# PROPERTIES

## Instrument

An instrument in whose _History_ an item will be added.

## Item type

Item type to be added, currently it can only be `"Chart"`.

## Chart description

Description of the chart displayed in the instrument _History_:

![Alt text](../images/add_to_instrument_history_description.png)

## Chart data

A string or blob containing the samples that will be displayed in the chart.

## Chart sampling rate

Sampling rate or number of samples per second SPS).

## Chart offset

Offset value used in formula `offset + sample_value * scale` which transforms sample value to sample position on y axis in the chart.

## Chart scale

When displaying samples, the formula `offset + sample_value * scale` is used.

## Chart format

Format from `Chart data`. Possible values:

- `"float"`: "Chart data" must be a blob containing 32-bit, little-endian float numbers
- `"double"`: "Chart data" must be a blob containing 64-bit, little-endian float numbers
- `"rigol-byte"`: "Chart data" must be a blob containing 8-bit unsigned integer numbers
- `"rigol-word"`: "Chart data" must be a blob containing 16-bit unsigned integer numbers
- `"csv"`: "Chart data" must be a CSV string, the first column is taken

## Chart unit

The unit displayed on the Y-axis. The X-axis is always time.

## Chart color

The color of the line in the chart if a dark background is selected.

## Chart color inverse

The color of the line in the chart if the light background is selected.

## Chart label

Chart label:

![Alt text](../images/add_to_instrument_history_label.png)

## Chart major subdivision horizontal

![Alt text](../images/add_to_instrument_history_major_subdivision_horizontal.png)

## Chart major subdivision vertical

![Alt text](../images/add_to_instrument_history_major_subdivision_vertical.png)

## Chart minor subdivision horizontal

![Alt text](../images/add_to_instrument_history_minor_subdivision_horizontal.png)

## Chart minor subdivision vertical

![Alt text](../images/add_to_instrument_history_minor_subdivision_vertical.png)

## Chart horizontal scale

The number that defines the X-axis zoom factor in the default chart view.

## Chart vertical scale

The number that defines the Y-axis zoom factor in the default chart view.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

A standard sequence output.

## seqout [DRAFT]

## id [DRAFT]

ID of the added history item. We can, for example, use this data in the `Chart` Widget to display the chart history item inside the dashboard.

# EXAMPLES [DRAFT]

-   Rigol Waveform Data
