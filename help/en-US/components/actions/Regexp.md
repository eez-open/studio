# DESCRIPTION

Searches a set string or stream, using a pattern written according to the rules of the regular expression syntax.

# PROPERTIES

## Pattern

Regular expression used for searching.

## Text

The text to be searched can be a string or a stream.

## Global

This option determines whether only the first occurrence of the pattern or every occurrence of the pattern is searched.

## Case insensitive

This option determines whether the search will be case sensitive or not.

# INPUTS

## seqin

A standard sequence input. This input needs to be used once at the beginning.

## next

Use this input to get the next match.

## stop

Use this input when we want to stop further searching, after which the Flow execution will immediately continue through the `done` output.

# OUTPUTS

## seqout

A standard sequence output.

## match

Search match in the form of `struct:$RegexpMatch` value is sent through this output. The `$RegexpMatch` structure has the following fields:

-   `index` (`integer`) - The 0-based index of the match in the string.
-   `texts` (`array:string`) - The array that has the matched text as the first item, and then one item for each [capturing group](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences) of the matched text.
-   `indices` (`array:array:integer`) - It is an array where each entry represents the bounds of a substring match. The index of each element in this array corresponds to the index of the respective substring match in the `texts` array. In other words, the first indices entry represents the entire match, the second indices entry represents the first capturing group, etc. Each entry itself is a two-element array, where the first number represents the match's start index, and the second number, its end index.

## done

Flow execution continues through this output when the search is complete, i.e. there are no more matches.

# EXAMPLES

- _RegExp String_
- _RegExp Stream_
