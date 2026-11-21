# Native assignable-list tests

Run from the Studio repository root with its normal build prerequisites and
locked dependencies. No companion checkout or application project is needed.

```powershell
npm ci
node tests/native-assignable-lists/run.cjs
npm run build-src
node tests/native-assignable-lists/bundle.cjs
node tests/native-assignable-lists/preview.cjs
```

`run.cjs` compiles this checkout into a temporary directory, then runs 24 tests
against its parser, type checker and bytecode compiler. Lightweight project
metadata adapters replace Electron, not the compiler. Outputs include bytecode
and `compiler-fixture.h` for the companion framework's native tests.

`bundle.cjs` uses only this checkout's built JS/WASM and real inspector binding.
It checks all six pairs (EEZ-GUI/Dashboard and five supported LVGL versions),
verifies the WASM payload against the tracked source, and reads an actual C++
reference through the inspection API. It also checks the bundled C++ API.

`preview.cjs` loads the included fixture in a real Electron ProjectStore and
builds its preview assets. It checks property-grid availability and validation
on EEZ-GUI, Dashboard, LVGL, EEZ GUI Lite and LVGL without Flow; the Lite code
generator must reject the option explicitly. The real LVGL exporter must copy
this checkout's reference-aware C++ amalgamation. It then exercises the five
built LVGL runtimes: Run/Debug pause and resume, both conditional branches,
single/list assignment, parameter inspection, array-element destinations and
unchanged ordinary value snapshots (20 scenarios).

The preview test temporarily hooks `build/home/build-project.js`, restores it in
`finally`, and uses a separate profile. Run it with Studio closed and do not run
it concurrently with another build or preview test. These scripts never change
the source fixture. An optional first argument selects an output directory;
the default is a new temporary directory. A completion marker prevents stale
outputs from making a failed renderer test pass.

For a private Electron host already pointing at this source checkout, set
`EEZ_TEST_ELECTRON` to its executable and `EEZ_TEST_PACKAGED_HOST=1`. Its packaged
resources must point at this checkout's resources too; no external runtime
replacement is performed by the tests. Normally these overrides are unnecessary.

These are headless Flow tests. The EEZ-GUI/Dashboard pair gets an ABI/inspection
smoke test; the execution scenarios cover LVGL. They do not claim visual UI or
hardware validation, nor completion of the full upstream test suite.
