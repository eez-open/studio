# Lists of assignable native-action parameters

An ordinary array expression evaluates its elements to values. It cannot carry a
list of independent assignment destinations: `[A, B]` normally contains the
values of `A` and `B`.

A native action can opt a user property into **Assignable list**. Set its type to
`array:any` and leave **Assignable** disabled. This option is restricted to native
actions. At the call site, enter an array literal of assignable expressions:

```
[Setpoint, Enabled, Values[SelectedIndex], Condition ? First : Second]
```

Each item is checked and compiled independently. Different destination types are
allowed between list items. The two destinations of a conditional item must
have the same type, including a conditional owner of an indexed destination.
Literals, arithmetic results and nonassignable conditional branches are rejected.
The normal array expression and the SetVariable action keep their existing semantics.

In native code, `eez::flow::getUserProperty(index)` returns an array whose elements
are reference `Value`s. Evaluate and validate every destination and input before
performing application-specific writes. This feature does not add transaction
semantics: a consumer requiring an atomic batch must validate and queue its batch
itself.

For an individual **Assignable** user property, the new
`eez::flow::getUserPropertyReference(index)` returns its reference without
dereferencing it. `getUserProperty(index)` retains its existing value semantics
for individual parameters; `setUserProperty` is unchanged.

Use the public `eez::flow::setUserPropertyReference(reference, value)` to write
through a reference obtained from either API. It uses the same assignment,
conversion, notification and Flow error handling as `setUserProperty`. Do not
access private Flow globals or call private assignment functions in a consumer.
Assignment is synchronous and has no transaction or rollback semantics.

References are valid only during the synchronous native call. Do not retain them,
store them in ordinary flow variables, or use them from an asynchronous callback.
In particular, a local-variable reference belongs to the calling flow instance.

The expression property remains visible to the existing scoped reference search.
Renaming a declaration updates its identifiers inside the list. A string literal
with the same spelling and a shadowing local declaration are separate objects.

## Asset format and runtime dependency

The property byte container has a marker `0xe400:u16`, an element count `u16`,
and a total byte size `u32` including that header. Each element has a word count
`u16` and its own assignable expression including the typed END instruction.
The runtime first validates all item and branch spans against the bytes actually
loaded or decompressed by the asset loader, then evaluates them. The embedded
size and allocation capacity are not trusted memory bounds.

This is a property container, not an expression opcode; it cannot occur inside
an ordinary expression. Ordinary array instructions and formats are unchanged.

Projects using this option require the companion framework change implementing
`evalAssignableListExpression`. Updating only the editor is insufficient. Existing
projects with the option disabled produce their existing instruction format.

## Studio Run/Debug

Studio's WASM runtime must use the matching framework change. Native actions
with an authored simulation Flow receive reference-valued parameters, so writes
from that Flow update the selected destinations. The inspector dereferences
values in C++ into owned, short-lived copies and frees them after converting to
JavaScript. Write-only Flow outputs have no readable value. This does not permit
retaining native-call references in asynchronous application code.

Distribute matching JS/WASM runtime pairs for EEZ-GUI/Dashboard and every
supported LVGL version with the compiler update. A compiler-only update leaves
Run/Debug unable to evaluate the new container.

## Verification

Check mixed native/global/local/array-element destinations, both conditional
branches, an empty list, independent calls, invalid entries, and ordinary arrays.
Rename the published declaration and a local shadow independently and confirm
that only references to the chosen object change. Native consumers must also test
their own lifetime and batch-error handling.
