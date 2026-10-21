# pext-lvgl-example

Example of an EEZ Flow extension for LVGL projects (see `docs/pext-lvgl.md`). It registers:

- the enum `Mode` (`enum:pext-lvgl-example/Mode`, `Mode.OFF` / `Mode.ON` in expressions),
- the structure `Point` (`struct:pext-lvgl-example/Point`), with a field of type `enum:Mode`,
- the native action component `SetMode`, with an enum property and a data output.

## Build

```
npm install
npm run build
```

Inside the Studio repository the types are taken from `packages/eez-studio-types` (see `src/tsconfig.json`), so `npm install` is not needed there.

## Install

Copy the folder (with `package.json` and `dist/`) into the Studio extensions folder (`<userData>/extensions/pext-lvgl-example`) and restart Studio, then add `pext-lvgl-example` in *Settings > General > Extensions* of an LVGL project with EEZ Flow and reload the project.

## Firmware

The build of the project declares the component function in `actions.h` and registers it in `screens.c`. The firmware implements it:

```c
#include "ui.h"
#include "actions.h"
#include "vars.h"

void eez_flow_ext_pext_lvgl_example_SetMode(void *flowState, unsigned componentIndex) {
    int32_t mode = evalIntegerProperty(flowState, componentIndex, 0, "Failed to evaluate Mode in SetMode");

    bool changed = set_mode((Mode)mode);

    flowPropagateValueInt32(flowState, componentIndex, 1, changed);
    flowPropagateValue(flowState, componentIndex, 0);
}
```
