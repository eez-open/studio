# DESCRIPTION

This Widget displays a bitmap. If we know in advance which bitmap we want to display, then it is necessary to use the `Bitmap` property, where the selection is called the bitmap, and if the bitmap is known only during execution because, for example, it comes from some variable, then it is necessary to use the `Data` property.

# PROPERTIES

## Data

There are several options for choosing which bitmap to display:

- If the default value is of type `integer` then it is the index of the bitmap to be displayed. It is necessary to use the functions `Flow.getBitmapIndex({<bitmapName>})`, which receives `bitmapName`, i.e. the name of the bitmap, and returns the index of the bitmap. In this way, we can choose or change which bitmap will be displayed in the runtime, because, for example, `bitmapName' can come from a variable.

- If the default value is of type `string` then it is assumed that the bitmap is encoded according to the [Data URI Scheme](https://en.wikipedia.org/wiki/Data_URI_scheme) rules.

- If the default value is of type `blob` then the bitmap is defaulted to its binary notation (see _Screen Capture_ example).

## Default style

Style used when rendering the background of the Widget.

## Bitmap

The name of the bitmap to be displayed.

## Custom ui [EMPTY]


# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

* _Dashboard Widgets Demo_
* _Screen Capture_
