# DESCRIPTION

It is used to print the content of the Widget. Currently, only printing of Tabulator widget is supported.

# PROPERTIES

## Widget

Reference to the Tabulator widget. See `Output widget handle` property to find out how to obtain this reference.

## Options

You can specify following print options through JSON:

-   landscape boolean (optional) - Paper orientation.true for landscape, false for portrait. Defaults to false.

-   scale number(optional) - Scale of the webpage rendering. Defaults to 1.

-   pageSize string | Size (optional) - Specify page size of the generated PDF. Can be A0, A1, A2, A3, A4, A5, A6, Legal, Letter, Tabloid, Ledger, or an Object containing height and width in inches. Defaults to Letter.

-   margins Object (optional)
    -   marginType string | Size (optional) - Can be "default" or "custom".
    -   top number (optional) - Top margin in inches. Defaults to 1cm (~0.4 inches).
    -   bottom number (optional) - Bottom margin in inches. Defaults to 1cm (~0.4 inches).
    -   left number (optional) - Left margin in inches. Defaults to 1cm (~0.4 inches).
    -   right number (optional) - Right margin in inches. Defaults to 1cm (~0.4 inches).

For example:

```
{
    landscape: true,
    scale: 1,
    pageSize: "A4",
    margins: {
        marginType: "custom",
        top: 0.8,
        bottom: 0.8,
        left: 0.8,
        right: 0.8
    }
}
```

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

-   _Tabulator Examples_
