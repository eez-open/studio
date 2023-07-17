# DESCRIPTION [DRAFT]

If this action is used inside Page or User Widget, it will move the position of the animation timeline from one position (`From` property) to another (`To` property) with given speed (`Speed` ​​property).

If you want to instantly jump to a certain position (`To` property), you should set the Speed to `0` - in that case the `From` property value doesn't matter (it can be set to the same value as `To` property).

The expression `Flow.pageTimelinePosition()` can be used for the `From` property and in that case the animation will start from the current position.

# PROPERTIES

## From [DRAFT]

Startna pozicija zadana u sekundama.

## To [DRAFT]

Krajnja pozicija zadana u sekundama.

## Speed [DRAFT]

Utječe na trajanje animacije. Ako se postavi na `1` onda će animacija trajati `From - To` sekundi. Ako se želi dvostruko brža animacija onda treba postaviti na `2`, a ako se želi dvostruko sporija animacija onda treba postaviti na `0.5`. Ako se želi da animacija traje točno određeno vrijeme `T` onda se može koristiti formula `T / (From - To)`, npr. ako je `T` jednako `0.5` sekundi, From `1` sekunda i To `3` sekunde onda treba za speed staviti `0.5 / (3 - 1)`, tj. `0.25`. Ako se postavi na `0` onda će se trenutno skočiti na `To` poziciju.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output. Aktivira se kada je animacija gotovo, tj. stiglo se do `To` pozicije.

# EXAMPLES [DRAFT]

-   Animation
-   sld-eez-flow-demo
