# DESCRIPTION [DRAFT]

Pomoću ove akcije možemo dohvati propertije instrumenta koji su definirani unutar IEXT instrument ekstenzije.

Npr., u `Rigol Waveform Data` exampleu želimo dohvatiti koliko kanala instrument ima i koja boja se koristi za svaki od kanala. Prvo, možemo pogladati koje sve propertije ima npr. Rigol DS1000Z instrument:

![Alt text](../images/get_instrument_properties_rigol_props.png)

Sada je potrebno definirati Flow variable type u koji želimo pospremiti propertije koji nas zanimaju. U ovom slučaju definiramo type `struct:InstrumentProperties` definiran ovako:

![Alt text](../images/get_instrument_properties_struct1.png)

Dakle, `InstrumentProperties` strukutra ima jedan member koji se zove `channels` koji je tipa `array:InstrumentPropertiesChannel`, a koji je definiran ovako:

![Alt text](../images/get_instrument_properties_struct2.png)

I sada koristeći ovu akciju u jednom koraku možemo dohvatiti informacije o svim kanalima:

![Alt text](../images/get_instrument_properties.png)

Nakon što smo dohvatili propertije, broj kanala možemo saznati sa `Array.length(properties.channels)`, a boju npr. 1. kanala sa: `properties.channels[0].color`.

# PROPERTIES

## Instrument [DRAFT]

Instrument čije propertije želimo dohvatiti.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## properties [DRAFT]

Na ovaj output se šalju dohvaćeni propertiji.

# EXAMPLES [DRAFT]

-   Rigol Waveform Data
