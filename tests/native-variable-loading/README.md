# Native-variable loading regression

After `npm run build-src`, run this from the Studio renderer's developer console:

```javascript
await require(require('node:path').join(require('node:process').cwd(), 'tests/native-variable-loading/check.cjs')).run()
```

Start Studio from the checkout root so that `process.cwd()` identifies this
checkout. The test creates private, in-memory `ProjectStore` instances, loads and
serializes a minimal LVGL project, then reopens that serialization in a fresh
store. It does not save or modify the project open in the editor.

Integer, float, double, boolean and string native globals must retain `native`.
An ordinary global must remain ordinary; an unsupported native array and a
native local must have the flag disabled. The result must remain stable after
serialization and reload. No assignable list, rename or native runtime is used.

Before the fix, the first valid native global fails this check because
`beforeLoadHook` consults `object.type` before the serializer populates that field.
