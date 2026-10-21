import type {
    IActionComponentDefinition,
    IEezFlowEditor,
    IExtensionEnumDefinition,
    IExtensionStructureDefinition
} from "eez-studio-types";

const ICON =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M13 2 4 13h7l-1 9 9-11h-7z"/></svg>`
    );

// enum:pext-lvgl-example/Mode, used in expressions as Mode.ON
const mode: IExtensionEnumDefinition = {
    name: "Mode",
    members: [
        { name: "OFF", value: 0 },
        { name: "ON", value: 1 }
    ]
};

// struct:pext-lvgl-example/Point
const point: IExtensionStructureDefinition = {
    name: "Point",
    fields: [
        { name: "x", type: "integer" },
        { name: "y", type: "integer" },
        { name: "mode", type: "enum:Mode" }
    ]
};

// implemented in the firmware by eez_flow_ext_pext_lvgl_example_SetMode()
const setMode: IActionComponentDefinition = {
    name: "SetMode",
    componentPaletteLabel: "Set Mode",
    icon: ICON,
    componentHeaderColor: "#5E7CE2",
    bodyPropertyCallback: (mode: string) => mode,
    inputs: [],
    outputs: [
        {
            name: "changed",
            type: "boolean",
            isSequenceOutput: false,
            isOptionalOutput: true
        }
    ],
    properties: [
        {
            name: "mode",
            displayName: "Mode",
            type: "expression",
            valueType: "enum:Mode"
        }
    ],
    defaults: {
        mode: "Mode.ON"
    },
    isNative: true
};

const extension = {
    eezFlowExtensionInit(eez: IEezFlowEditor) {
        eez.registerEnumVariableType(mode);
        eez.registerStructureVariableType(point);
        eez.registerActionComponent(setMode);
    }
};

export default extension;
