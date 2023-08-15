# PROPERTIES

## Resizing [DRAFT]

Ako stranica u kojoj se nalazi ovaj widget ima omogućenu opciju "Scale to fit", onda se pomoću ove opcije može kontrolirati kako će se izračunati pozicija i veličina widgeta prilikom skaliranja stranice:

![Alt text](./images/widget_resizing.png)

Pomoću "Pin to edge" opcije možemo fiksirati top, right, bottom i left edge od widgeta u odnosu na stranicu kada ona mijenja svoju originalnu dimenziju jer je opcija "Scale to fit" odabrana. Npr. ako smo odabrali Pin to top edge onda će razmak između top edga stranice i top edga widgeta biti uvijek isti, drugim riječima Top pozicija ne mijenja vrijednost. Ako nije odabran Pin to top edge, onda će se Top pozicija proporcionalno sklairati kako se skalira visina stranice.

Pomoću "Fix size" opcije možemo fiksirati širinu/visinu widgeta, tj. ako je ova opcija odabrana širina/visina će biti uvijek ista, a ako nije odabrana širina/visina
će se proporcionalno skalirati kako se skalira visina stranice.

Napomena: Ako je odabrano pin to left and right edge onda će fix width opcija disejblana, i obrunuto ako je odabran fix width onda se ne može odabrati i pin to left i pin to right edge, jer oboje nije moguće zadovoljiti. Isto vrijedi i za pin to top and bottom i fix width.

## Visible [DRAFT]

Ako je izračunati expression true onda je widget visible, a ako je false onda je widget hidden. Može se ostaviti prazno, u tom slučaju widget je uvijek visible.

## Style ui [EMPTY]

## Hide "Widget is outside of its parent" warning [DRAFT]

Check this if you want to hide "Widget is outside of its parent" warning.

## Locked [EMPTY]

## Hidden in editor [EMPTY]

## Timeline [EMPTY]

## Keyframe editor [EMPTY]

## Event handlers [DRAFT]

Lista event handler definicija. Tijekom izvršavanja widget može generirati određene evente (npr. `CLICKED` event se generira kada se preko touch uređaja pritisne i otpusti unutar widgeta) i kroz ovu listi možemo zadati način obrade eventa. Za svaki event handler moramo definirati ove propertije:

-   `Event`: Event koji se obrađuje, npr. `CLICKED`.
-   `Handler type`: Postoje dvije opcije: `Flow` ili `Action`. Ako je odabran `Flow` biti će dodan flow output kroz koji se izlazi prilikom obrade eventa, a ako je odabran "Action" onda treba zadati koja user akcija će se izvršiti prilikom obrade eventa.
-   `Action`: Ako je za `Handler type` zadano `Action` onda ovdje treba zadati naziv user akcije koja će se izvršiti prilikom obrade odabranog eventa.
