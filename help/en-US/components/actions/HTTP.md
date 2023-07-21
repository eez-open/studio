# DESCRIPTION [DRAFT]

Sends HTTP requests and returns the response.

# PROPERTIES

## Method [DRAFT]

HTTP metoda koja se koristi: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT ili TRACE.

## Url [DRAFT]

The url of the request.

## Headers [DRAFT]

Lista headera koji se šalju na server. Za svaki item treba postaviti naziv headera i string vrijednost.

## Body [DRAFT]

Body koji se šalje na server ako je odabrana POST, PUT ili PATCH metoda.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

## status [DRAFT]

The [status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status) of the response.

## result [DRAFT]

The body of the response.

# EXAMPLES [DRAFT]

-   Simple HTTP
