# DESCRIPTION

Compares expressions depending on the operator and if the result is `true` Flow execution continues through `True` output, otherwise `False` output is used.

# PROPERTIES

## A

Expression on the left side of the comparison.

## B

Expression on the right side of the comparison.  
It is not used if the operator is `NOT`.

## C

This expression is used only in the case of the `BETWEEN` operator, then it is checked whether `A >= B` and `A <= C`.

## Operator

It is possible to use one of the following operators:

-   `=` – A is equal to B, i.e. `A == B`
-   `<` – A is less than B, i.e. `A < B`
-   `>` – A is greater than B, i.e. `A > B`
-   `<=` – A is less or equal to B, i.e. `A <= B`
-   `>=` – A is greater or equal to B, i.e. `A >= B`
-   `<>` – A is different then B, i.e. `A != B`
-   `NOT` – A is not true, i.e. `!A`
-   `AND` – both A and B are true, i.e. `A && B`
-   `OR` – either A or B is true, i.e. `A || B`
-   `XOR` – either A or B is true, but not both, `A ^^ B`
-   `BETWEEN` – A is between B and C, i.e. A is greater then or equal to B and A is less then or equal to C, i.e. `A >= B AND A <= C`

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## True

Output that will be used to continue execution of the Flow if the value of the expression is `true`.

## False

Output that will be used to continue execution of the Flow if the value of the expression is `false`.

# EXAMPLES [EMPTY]
