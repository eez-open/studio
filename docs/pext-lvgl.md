# Extensions in LVGL projects

EEZ Flow extensions (`"eez-studio": { "node-module": true }` in `package.json`, `eezFlowExtensionInit`) can be used in LVGL projects with EEZ Flow support. An extension can provide:

- enumerations (`registerEnumVariableType`),
- structures (`registerStructureVariableType`),
- action components (`registerActionComponent`) that are implemented in the firmware (`isNative: true`).

The extension is added to the project in *Settings > General > Extensions*, as for Dashboard projects. Dashboard projects are not affected by any of this.

See `examples/pext-lvgl-example` for a complete extension.

## Extension API

```ts
import type { IEezFlowEditor } from "eez-studio-types";

const extension = {
    eezFlowExtensionInit(eez: IEezFlowEditor) {
        eez.registerEnumVariableType({
            name: "Mode",
            members: [
                { name: "OFF", value: 0 },
                { name: "ON", value: 1 }
            ]
        });

        eez.registerStructureVariableType({
            name: "Point",
            fields: [
                { name: "x", type: "integer" },
                { name: "y", type: "integer" },
                { name: "mode", type: "enum:Mode" }
            ]
        });

        eez.registerActionComponent({
            name: "SetMode",
            icon: "...",
            componentHeaderColor: "#5E7CE2",
            inputs: [],
            outputs: [],
            properties: [
                { name: "mode", type: "expression", valueType: "enum:Mode" }
            ],
            isNative: true
        });
    }
};

export default extension;
```

Type, member and field names must be C identifiers (`[A-Za-z_][A-Za-z0-9_]*`). A definition that does not comply is ignored and reported in the *Checks* panel.

## Names

| | Type system | Expressions | Generated C |
|---|---|---|---|
| Action `SetMode` of extension `myext` | class `myext/SetMode` | | `eez_flow_ext_myext_SetMode` |
| Enum `Mode` | `enum:myext/Mode` | `Mode.ON` | `typedef enum { Mode_OFF = 0, Mode_ON = 1 } Mode;` |
| Struct `Point` | `struct:myext/Point` | `.x`, `.y`, `.mode` | `FLOW_STRUCTURE_MYEXT_POINT`, `struct PointValue` |

- Inside an extension, a field type `enum:X`, `struct:X`, `array:enum:X` or `array:struct:X` where `X` is a type registered by the same extension is resolved to `<extension>/X`. In component definitions, enums can be referenced as `enum:Mode` or `enum:myext/Mode`, structures as `struct:myext/Point`.
- Expressions use the short name of an enum (`Mode.ON`), so the short names of enums must be unique across the project and its extensions. Structure short names must be unique too, because they name the generated C types. A conflict is reported in *Checks* on *Settings > General > Extensions*; the first registered type is kept.

## Generated code

The build of an LVGL project with EEZ Flow emits, in the existing template sections:

- `vars.h` (`FLOW_ENUMS`): the enum typedefs, with the short name.
- `structs.h` (`FLOW_STRUCTS`, `FLOW_STRUCT_VALUES`): the `FLOW_STRUCTURE_<EXT>_<NAME>` indexes and the `<Name>Value` accessor class, as for project structures.
- `actions.h` (`LVGL_ACTIONS_DECL`): for each native extension component used in the flows, `extern void eez_flow_ext_<ext>_<Name>(void *flowState, unsigned componentIndex);`. The function name is the class name with every character other than `[A-Za-z0-9_]` replaced by `_`.
- `screens.c` (`LVGL_SCREENS_DEF`), at the top of `create_screens()`: `eez_flow_register_ext_component(<type>, eez_flow_ext_<ext>_<Name>);`. `<type>` is the component type assigned by the build (from 10000); declarations, registrations and the assets are generated together, so they always match.

An action component without `isNative` cannot be built for an LVGL target: the component is flagged in *Checks* and the build reports "Component is not implemented for the build target".

## Firmware

eez-framework provides `eez_flow_register_ext_component()` (C) and accepts component types from 10000 in `eez::flow::registerComponent()`. Up to `EEZ_FLOW_MAX_EXT_COMPONENTS` (64) components can be registered; the value can be changed in `eez-framework-conf.h`.

The firmware implements the declared functions:

```c
#include "ui.h"
#include "actions.h"
#include "vars.h"

void eez_flow_ext_myext_SetMode(void *flowState, unsigned componentIndex) {
    int32_t mode = evalIntegerProperty(flowState, componentIndex, 0, "Failed to evaluate Mode in SetMode");

    set_mode((Mode)mode);

    flowPropagateValue(flowState, componentIndex, 0);
}
```

- Properties: `evalIntegerProperty`, `evalTextProperty`, `evalBooleanProperty`, `assignIntegerProperty`, ... (C API of `eez/flow/lvgl_api.h`). The property index is the position of the property among the expression properties of the component (`expression`, `assignable-expression`, `template-literal`), in declaration order, starting at 0. Values of other types are available through the C++ API: `eez::flow::evalProperty()`, `eez::flow::evalAssignableProperty()`, `eez::flow::assignValue()`.
- Outputs: `flowPropagateValue(flowState, componentIndex, outputIndex)`, `flowPropagateValueInt32()`, `flowPropagateValueUint32()`. Output 0 is `@seqout`, followed by the declared outputs in order. `@seqout` must be propagated for the flow to continue.
- Errors: `eez::flow::throwError(flowState, componentIndex, message)` (C++).

## Simulator

The Studio simulator and *Check* cannot run firmware code. A native extension component is built as a no-op component there: `@seqout` is propagated, the data outputs are never set and the component never fails. The flow continues, so the rest of the project can be tested in the simulator.
