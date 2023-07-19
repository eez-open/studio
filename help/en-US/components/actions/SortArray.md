# DESCRIPTION

It sorts the array variable and returns the result through the data output: it does not do in-place sorting, i.e. it does not modify the content of the array variable. Allowed array types are:

-   `array:integer`
-   `array:float`
-   `array:double`
-   `array:struct`

If an array of type `array:struct` is sorted, then the `Structure name` and `Structure field name` by which it is sorted must also be specified.

There are also two options: whether Ascending/Descending sorting is desired and whether letter case is ignored if strings are sorted.

# PROPERTIES

## Array

Array variable to be sorted.

## Structure name

Select the name of the structure here when the array is a variable of type `array:struct`.

## Structure field name

Select the name of the field to be sorted by if the array is a variable of type `array:struct`.

## Ascending

Sorting mode selection (ascending if enabled, otherwise descending).

## Ignore case

Specifies whether letter case is ignored if strings are sorted or not.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## result

Output through which the sorted array is passed.

# EXAMPLES [EMPTY]
