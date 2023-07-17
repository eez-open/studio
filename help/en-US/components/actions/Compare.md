# DESCRIPTION [DRAFT]

Uspoređuje expressione u ovisnosti o operatoru i ako je rezultat `true` izlazi na `True` output, inače izlazi na `False` output¸

# PROPERTIES

## A [DRAFT]

Expression na lijevoj strani usporedbe.

## B [DRAFT]

Expression na desnoj strani usporedbe.

Ako je operator NOT onda se ovaj expression ne koristi.

## C [DRAFT]

Ovaj expression se koristi samo u slučaju BETWEEN operatora, tada se gleda da li je A >= B i A <= C.

## Operator [DRAFT]

Jedan od mogućih operatora:

-   `=`: A is equal to B, i.e. `A == B``
-   `<`: A is less than B, i.e. `A < B``
-   `>`: A is greater than B, i.e. `A > B``
-   `<=`: A is less or equal to B, i.e. `A <= B``
-   `>=`: A is greater or equal to B, i.e. `A >= B``
-   `<>`: A is different then B, i.e. `A != B``
-   `NOT`: A is not true, i.e. `!A``
-   `AND`: both A and B are true, i.e. `A && B`
-   `OR`: either A or B is true, i.e. `A || B`
-   `XOR`: either A or B is true, but not both, `A ^^ B`
-   `BETWEEN`: A is between B and C, i.e. A is greater then or equal to B and A is less then or equal to C, i.e. `A >= B AND A <= C`

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## True [DRAFT]

Izlazi se na ovaj output ako je rezultat usporedbe `true`.

## False [DRAFT]

Izlazi se na ovaj output ako je rezultat usporedbe `false`.

# EXAMPLES [EMPTY]
