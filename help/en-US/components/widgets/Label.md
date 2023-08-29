# DESCRIPTION [DRAFT]

A widget used to display text.

[More info](https://docs.lvgl.io/8.3/widgets/core/label.html)

# PROPERTIES

## Text [DRAFT]

Text to be displayed.

## Text type [DRAFT]

Ovdje se može odabrati da se `Text` property računa iz Expressiona.

## Long mode [DRAFT]

Ako se za `Width` i `Height` odabere `content` onda ovaj property nema efekta jer će se veličina widgeta automatski postaviti da stane čitav tekst, ali ukoliko je veličina widgeta postavljena ručno ('px' ili '%') onda se pomoću ovog propertija definira način na koji se lomi tekst ako ne stane unutar granica widgeta:

-   `WRAP`: Wrap too long lines. If the `Height` is set to `content` it will be expanded, otherwise the text will be clipped. (Default)
-   `DOT`: Replaces the last 3 characters from bottom right corner of the label with dots.
-   `SCROLL`: If the text is wider than the label scroll it horizontally back and forth. If it's higher, scroll vertically. Only one direction is scrolled and horizontal scrolling has higher precedence.
-   `SCROLL_CIRCULAR`: If the text is wider than the label scroll it horizontally continuously. If it's higher, scroll vertically. Only one direction is scrolled and horizontal scrolling has higher precedence.
-   `CLIP`: Simply clip the parts of the text outside the label.

## Recolor [DRAFT]

If this is enabled then, in the text, you can use commands to recolor parts of the text. For example: "Write a #ff0000 red# word".

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

# EXAMPLES [EMPTY]
