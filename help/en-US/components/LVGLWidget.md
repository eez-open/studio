# PROPERTIES

## Name [DRAFT]

Naziv widgeta. Unutar projekte referenciramo widget prema njegovom nazivu, npr. u LVGL akciji. Za svaki widget moramo odabrati unique naziv unutar čitavog projekta. Ovo polje nije obavezno i ne treba se postaviti ukoliko nemamo potrebe za referenciranjem widgeta.

## Left unit [DRAFT]

Ovdje imamo ove opcije:

-   `px`: Left je zadan u pikselima.
-   `%`: Left je zadan kao postotak u odnosu na parent width

## Top unit [DRAFT]

Ovdje imamo ove opcije:

-   `px`: Top je zadan u pikselima.
-   `%`: Top je zadan kao postotak u odnosu na parent height

## Width unit [DRAFT]

Ovdje imamo ove opcije:

-   `px`: Width je zadan u pikselima.
-   `%`: Width je zadan kao postotak u odnosu na parent width
-   `content`: Width se automatski postavlja tako da stane čitav content po širini.

## Height unit [DRAFT]

Ovdje imamo ove opcije:

-   `px`: Height je zadan u pikselima.
-   `%`: Height je zadan kao postotak u odnosu na parent height.
-   `content`: Height se automatski postavlja tako da stane čitav content po visini

## Children [EMPTY]

## Hidden

Make the object hidden.

## Hidden flag type [DRAFT]

Ovdje se može odabrati da se Hidden flag stanje računa iz Expressiona.

## Clickable

Make the object clickable by input devices

## Clickable flag type [DRAFT]

Ovdje se može odabrati da se Clickable flag stanje računa iz Expressiona.

## Click focusable

Add focused state to the object when clicked

## Checkable

Toggle checked state when the object is clicked

## Scrollable

Make the object scrollable

## Scroll elastic

Allow scrolling inside but with slower speed

## Scroll momentum

Make the object scroll further when "thrown"

## Scroll one

Allow scrolling only one snappable children

## Scroll chain hor

Allow propagating the horizontal scroll to a parent

## Scroll chain ver

Allow propagating the vertical scroll to a parent

## Scroll chain

Allow propagating both the horizontal and the vertical scroll to a parent

## Scroll on focus

Automatically scroll object to make it visible when focused

## Scroll with arrow

Allow scrolling the focused object with arrow keys

## Snappable

If scroll snap is enabled on the parent it can snap to this object

## Press lock

Keep the object pressed even if the press slid from the object

## Event bubble

Propagate the events to the parent too

## Gesture bubble

Propagate the gestures to the parent

## Adv hittest

Allow performing more accurate hit (click) test. E.g. accounting for rounded corners

## Ignore layout

Make the object positionable by the layouts

## Floating

Do not scroll the object when the parent scrolls and ignore layout

## Overflow visible

Do not clip the children's content to the parent's boundary

## Scrollbar mode [EMPTY]

## Scroll direction [EMPTY]

## Checked

Toggled or checked state

## Checked state type [DRAFT]

Ovdje se može odabrati da se Checked stanje računa iz Expressiona.

## Disabled

Disabled state

## Disabled state type [DRAFT]

Ovdje se može odabrati da se Disabled stanje računa iz Expressiona.

## Focused

Focused via keypad or encoder or clicked via touchpad/mouse

## Pressed

Being pressed

## Use style [DRAFT]

Ovdje možemo odabrati neki od globalno definiranih stilova tako da widget koristi taj stil.

## Local styles [EMPTY]
