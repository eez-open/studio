-   Stilovi se koriste za postavljanje izgleda widgeta, a sadrže niz propertija kao što su: Color (boja teksta), Background color, Border size, itd. Koji sve propertiji postoje ovisi o vrsti projekta.

-   Ne moraju se svi propertiji definirati, oni koji nisu definirani koriste defaultne vrijednosti.

-   Widgeti imaju lokalne stilove, a mogu koristiti i neki od stilova koji su definirani kroz Styles panel. Promjene u lokalnim stilovima imaju prednost.

-   Na primjer u ovom screenshotu su prikazani stilovi za Button widget u EEZ-GUI projektu:

    ![Alt text](button_widget_eez_gui.png)

    Tu se vidi da se koristi ("Use style" property) `button` stil koji je definiran u Styles panelu. Također, vidi se da je lokalno napravljena jedna izmjena u `Color` propertiju. Ova izmjena se može poništiti clickom na dark rectangle na desnoj strani propertija i odabirom Reset opcije:

    ![Alt text](property_reset.png)

    Rectangle desno od propertija može biti popunjen ili prazan. Popunjen znači da je property lokalno mijenjan.

    Ako je rectangle prazan onda se može preko tooltipa doznati iz kojeg stila dolazi taj property:

    ![Alt text](image-1.png)

-   Kroz Styles panel se može definirati hijerarhija stilova korištenjem drag and dropa.

    ![Alt text](image-2.png)

    Npr. na gornjoj slici `button_disabled` nasljeđuje sve propertije od `button`, koji pak nasljeđuje od `default`

-   Objasniti ovaj meni:

    ![Alt text](image-3.png)

-   Postoje određene razlike u definiranju stilova među vrstama projekta.
