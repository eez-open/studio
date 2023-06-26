-   Kolekcija bitmapa koje se koriste u projektu.

![Alt text](image-1.png)

-   Toolbar

![Alt text](image-3.png)

-   Dodavanje bitmape:

![New Bitmap in Dashboard](image-4.png)

![New Bitmap in EEZ-GUI](image-5.png)

![New Bitmap in LVGL](image-6.png)

-   Bitmapa se može koristiti u stilu ili u Bitmap widgetu (Dashboard i EEZ-GUI projekt), tj. Image widgetu (LVGL projekt)

-   Primjer korištenja bitmape u Bitmap widgetu u Dashboard projektu:

![Alt text](image-2.png)

-   Bitmap properties:

![Alt text](image.png)

    -   Name: Naziv bitmape po kojem se bitmapa referencira u ostatku projekta
    -   Description: Neobavezni opis bitmape
    -   Image: Ovo je sami image file koji se sprema unutar projekt fajla (embedded within project file). Postoji button Export Bitmap File s kojim se može eksportati embeddani image.

Posebno za EEZ-GUI projekt imamo ove dodatne propertije:

-   Id
    -   ovo sam već prije objasnio ćemu služi
-   Bits per pixel:
    -   32: RGBA
    -   16: RGB565
-   Style:
    -   Ovo imamo samo ako je za "Bits per pixel" odabrano 16.
    -   Koristi se samo background color iz čitavo stila
    -   Ako postoji neki transparentni pixel u zadanoj bitmapi onda će biti prikazan background color

A za LVGL projekt imamo ovaj dodatni properti:

-   Color format: https://docs.lvgl.io/8.3/overview/image.html#color-formats
