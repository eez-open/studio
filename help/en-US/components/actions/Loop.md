# DESCRIPTION [DRAFT]

Ova akcija se koristi za izvršavanje određeno dijela flowa u petlji. Postavi se ova akciju na početak tog dijela flowa i uđe se na `Start` input, na kraju tog dijela flowa vrati se u ovu akciju, ali kroz `Next` input. Prolaskom kroz ovu akciju, zadana varijable kreće od `From` do `To` vrijednosti s korakom `Step`. Dakle, kroz ovu akciju će se proći `(From - To + 1) / Math.abs(step)` puta prije nego što se izađe kroz `Done` output. Ako se želi prekinuti ponavljanje i prije nego što se dosegne `To` vrijednost, onda jednostavno ne treba se vratiti na `Next` input. Također, moguće je i "ručno" sa `SetVariable` mijenjati varijablu po kojoj se iterira, i na taj način preskočiti jedan ili više koraka.

![Alt text](../images/loop.png)

# PROPERTIES

## Variable [DRAFT]

Varijabla čija vrijednost se mijenja prolaskom kroz ovu akciju.

## From [DRAFT]

Početna vrijednost varijable.

## To [DRAFT]

Krajna vrijednost varijable.

## Step [DRAFT]

Vrijednost s kojom se uvečava varijabla u svakom koraku. Može biti pozitivan ili negativan broj.

# INPUTS

## start [DRAFT]

Kada se uđe na ovaj input, varijabla se postavlja na `From` vrijednost i izlazi kroz `seqout`.

## next [DRAFT]

Kada se uđe na ovaj input, varijabla se uvečava za `Step` vrijednost i testira da li je manja ili jednaka od `To` vrijednosti ako je `Step` pozitivam, odnost da li je veća ili jednaka ako je `Step` negativan. Ako varijabla nije prekoračila `To` vrijednost onda se izlazi kroz `seqout`, inače se izlazi kroz `Done` output.

# OUTPUTS

## seqout [DRAFT]

Kroz ovaj output se izlazi za vrijeme trajanja iteriranja.

## done [DRAFT]

Kroz ovaj output se izlazi kada je iteriranje završeno.

# EXAMPLES [DRAFT]

-   Loop
