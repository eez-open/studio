# PROPERTIES

## Align and distribute [DRAFT]

Ikone za poravnavanje i distribucija komponenti. Ikone za poravnavanje se pojavljuju kad je selektirano dvije ili više komponenti, a ikone za distribuciju kad je selektirano tri ili više komponenti.

![Alt text](images/align_and_distribute.png)

## Left [DRAFT]

X pozicija komponente u odnosu na page ili parent widget. Zadaje se u pikselima.

Hint: prilikom postavljanja vrijednosti ovog propertija (kao i `Top`, `Width` i `Height` propertija) mogu se koristiti jednostavni matematički izrazi. Unese se izraz i pritisne enter, nakon čega će se izraz evaluirati i rezultat postaviti kao vrijednost ovog propertija. U izrazima je dopušteno koristiti operatore `+`, `-`, `*` i `/`. Također, mogu se koristiti i zagrade. Primjeri takvih matematičkih izraza: `18 + 36`, `50 + 32 * 6`, `(100 - 32) / 2`.

## Top [DRAFT]

Y pozicija komponente u odnosu na page ili parent widget. Zadaje se u pikselima.

## Width [DRAFT]

Širina komponente. Zadaje se u pikselima.

## Height [DRAFT]

Visina komponente. Zadaje se u pikselima.

## Absolute position [DRAFT]

Apsolutna pozicija komponente u odnosu na page. Ovaj property je read-only.

## Center widget [DRAFT]

Ikone za horizontalno i vertikalno centriranje widgeta unutar stranice ili parent widgeta.

![Alt text](images/widget_centering.png)

## Inputs [DRAFT]

Ovo su dodatni inputi komponente koje korisnik može dodati po želji kako bi se kroz njih primili dodatni podaci potrebni prilikom evaluacije expressiona u propertijima. Za svaki input se zadaje name i type. Name se koristi prilikom referenciranja inputa unutar expressiona. A type služi kod project checkinga kako bi se provjerilio da li je na input spojena data linija koja prenosi podatak tog tipa.

## Outputs

Ovo su dodatni outputi komponente koje korisnik može dodati po želji kako bi se preko njih poslao podatak. Za svaki output se zadaje name i type. Primjer korištenja ovakvog outputa je npr. u Loop komponenti, gdje se za `Variable` property može staviti output name umjesto npr. variable name. U tom slućaju loop komponenta neće u svakom koraku mijenjati sadržaj varijable nego će trenutnu vrijednost slati kroz taj output.

## Catch error [DRAFT]

Ako se enejbla ovaj checkbox onda će se dodati `@Error` output u komponentu i ako se tijekom izvršavanja flowa desi greška u ovoj komponenti, flow će nastaviti kroz taj output. Pritom, podatak koji će se proslijediti kroz taj output je tekstualni opis greške.
