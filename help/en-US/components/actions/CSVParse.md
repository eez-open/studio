# DESCRIPTION

Parses a CSV string, constructs a value of the set type and sends it through the `result` output.

# PROPERTIES

## Input

CSV string to be parsed.

## Delimiter

Defines the character used to delimit fields within a CSV record. The default delimiter is `","`.

## From

Defines the starting record to be processed. Counting is 1-based, i.e. for the first record it is necessary to set 1 (not 0).

## To

Defines the last record to be processed. Counting is 1-based, i.e. for the 5th record it is necessary to set 5 (not 4).

# INPUTS

## seqin

A standard sequence input.

## text

The input through which the CSV string to be parsed is received. This input can be deleted (we delete it in the Flow - Inputs list) if it is not needed, i.e. if we want to parse a string obtained by evaluating an arbitrary expression set through `Input` property.

# OUTPUTS

## seqout

A standard sequence output.

## result

Data output to which the constructed value is sent. The type of that value must be specified - this should be done in the Flow - Outputs section:

![Alt text](../images/csv_result_output_type.png)

In the _CSV_ example mentioned below, we have a CSV string that looks like this:

```
[
    {
        "country": "Afghanistan",
        "city": "Kabul"
    },
    {
        "country": "Albania",
        "city": "Tirana"
    },
    {
        "country": "Algeria",
        "city": "Alger"
    },
    ...
]
```

The constructed value returned by this Action should be of type `array:CountryCity`, where `CountryCity` is a structure that has two fields (the name of the structure `CountryCity` is arbitrarily chosen by the developer):

-   `country`, whose type is `string`
-   `city`, whose type is `string`

The definition of that structure looks like this in the Project editor:

![Alt text](../images/csv_countrycity_struct_def.png)

# EXAMPLES

- _CSV_
