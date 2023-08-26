# DESCRIPTION [DRAFT]

Prikazuje Terminal prozor kroz koji korisnik može unjeti proizvoljan tekst, kako se tekst unosi, znak po znak se šalje kroz `onData` output. Također se može i kroz flow upisivati tekst u terminal koristeći `Data` property.

# PROPERTIES

## Data [DRAFT]

Tekst koji se upisuje u Terminal prozor. Potrebno je dodati flow input tipa `string` ili `stream` i u ovaj property upisati naziv tog inputa. Ako je flow input tipa `string` onda je potrebno na taj input poslati string koji se želi upisati u terminal - ovo je moguće napraviti više puta, tj. svaki put kada se dobije neki string na taj input on će biti upisan u terminal. Ako je flow input tipa stream onda Terminal Widget sluša da li ima neki novi podatak na streamu i kada se on pojavi onda ga upisuje u terminal - npr. na ovaj način je moguće povezati `stdout` ili `stderr` izlaz iz ExecuteCommand akcije na Terminal Widget.

## Default style

Style used when rendering of the Widget.

# INPUTS [EMPTY]

# OUTPUTS [EMPTY]

## onData [DRAFT]

Kroz ovaj output se šalje uneseni tekst znak po znak.

# EXAMPLES

-   _Dashboard Widgets Demo_
