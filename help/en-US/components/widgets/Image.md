# DESCRIPTION [DRAFT]

This Widget displays an image.

[More info](https://docs.lvgl.io/8.3/widgets/core/img.html)

# PROPERTIES

## Image [DRAFT]

The name of the bitmap to be displayed.

## Pivot X [DRAFT]

X pozicija centra rotacije. Ako se ostavi prazno onda je centar rotacija u sredini widgeta.

## Pivot Y [DRAFT]

Y pozicija centra rotacije. Ako se ostavi prazno onda je centar rotacija u sredini widgeta.

## Scale [DRAFT]

Scale factor. Set factor to 256 to disable zooming. A larger value enlarges the images (e.g. 512 double size), a smaller value shrinks it (e.g. 128 half size). Fractional scale works as well, e.g. 281 for 10% enlargement.

## Rotation [DRAFT]

Rotation angle, angle has 0.1 degree precision, so for 45.8° set 458. Image is rotated around the centar of rotation which is defined with `Pivot X` and `Pivot Y` properties.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES

-   _LVGL Widgets Demo_
