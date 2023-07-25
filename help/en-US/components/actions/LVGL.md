# DESCRIPTION [DRAFT]

Izvršava jednu ili više LVGL specific akcija.

# PROPERTIES

## Actions [DRAFT]

Lista akcija koje treba izvršiti. Moguće akcije su:

-   Change Screen

    Mijenja aktivni ekran. Postoje ove opcije:

    -   Previous screen: ako je checked onda će se otići na prethodni ekran, inače treba odabrati ekran na koji se želi prikazati.
    -   Screen: naziv ekrana koji se želi prikazati.
    -   Fade mode: odabir animacije prilikom prelaska sa prethodnog na novi ekran. Ovo su opcije:
        -   None: switch immediately after delay ms
        -   Over Left/Right/Top/Bottom: move the new screen over the other towards the given direction.
        -   Move Left/Right/Top/Bottom: move both the old and new screens towards the given direction.
        -   Fade In/Out: fade the new screen over the old screen, or vice versa.
        -   Out Left/Right/Top/Bottom: move out the old screen over the current towards the given direction.
    -   Speed: trajanje animacije u milisekundama.
    -   Delay: delay u milisekundama prije nego što započne animacija.

-   Play Animation

    Animira odabrani property odabranog widgeta. Postoje ove opcije:

    -   Target: widget čiji property se animira
    -   Property: property koji se animira.
    -   Start: početna vrijednost propertija.
    -   End: krajnja vrijednost propertija.
    -   Delay: delay u milisekundama prije nego što započne animacija.
    -   Time: ukupno vrijeme trajanja animacije u milisekundama.
    -   Relative: da li su Start i End vrijednosti relativne u odnosu na trenutnu vrijednost ili su absolutne vrijednosti.
    -   Instant: if checked apply the start value immediately, otherwise apply start value after delay when the anim. really starts.
    -   Path: Određuje krivulju animacije. Moguće opcije su:
        -   Linear: calculate the current value of an animation applying linear characteristic
        -   Ease in: calculate the current value of an animation slowing down the start phase
        -   Ease out: Calculate the current value of an animation slowing down the end phase
        -   Ease in out: Calculate the current value of an animation applying an "S" characteristic (cosine)
        -   Overshoot: Calculate the current value of an animation with overshoot at the end
        -   Bounce: Calculate the current value of an animation with 3 bounces

-   Set Property

    Mijenja vrijednost odabranog property za odabrani widget. Postoje ove opcije:

    -   Target type: Vrsta widgeta koja se mijenja.
    -   Target: widget čiji property se mijenja.
    -   Property: property koji se mijenja.
    -   Value: nova vrijednost propertija.
    -   Animated: ako za property postoji mogućnost animiranja onda se može odabrati da promjena bude animirana. Npr. za Slider, mijenjanje pozicije slidera (Value property) može biti animirana.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [DRAFT]

-   Change Screen
