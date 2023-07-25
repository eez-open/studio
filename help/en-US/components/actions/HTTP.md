# DESCRIPTION

Sends HTTP requests and returns the response.

# PROPERTIES

## Method

HTTP methods used: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT or TRACE.

## Url

The url of the request.

## Headers

List of headers sent to the server. A header name and a string value should be set for each item.

## Body

The body of the message that is sent to the server if the POST, PUT or PATCH method is selected.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

## status

The [status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status) of the response.

## result

Message body of received response.

# EXAMPLES

- _Simple HTTP_
