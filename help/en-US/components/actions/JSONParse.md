# DESCRIPTION

Parses a JSON string, constructs a value of the set type and sends it through the `result` output.

# PROPERTIES

## Value

JSON string to be parsed.

# INPUTS

## seqin

A standard sequence input.

## text

The input through which the JSON string to be parsed is received. This input can be deleted (we delete it in the Flow - Inputs list) if it is not needed, i.e. if we want to parse a string obtained by evaluating an arbitrary expression set through `Value` property.

# OUTPUTS

## seqout

A standard sequence output.

## result

Data output to which the constructed value is sent. The type of that value must be specified – this should be done in the Flow – Outputs section:

![Alt text](../images/json_result_output_type.png)

In the _JSON_ example mentioned below, we have a JSON string that looks like this:

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

![Alt text](../images/json_countrycity_struct_def.png)

# EXAMPLES

- _JSON_
