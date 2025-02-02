import { MenuItem } from "@electron/remote";
import React from "react";
import { computed, makeObservable, observable, toJS } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { validators } from "eez-studio-shared/validation";

import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    EezObject,
    getClassesDerivedFrom,
    getParent,
    IEezObject,
    IMessage,
    PropertyProps,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import { LVGLStylesDefinitionProperty } from "project-editor/lvgl/LVGLStylesDefinitionProperty";
import { ProjectContext } from "project-editor/project/context";
import { LVGLStylesDefinition } from "project-editor/lvgl/style-definition";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { createObject } from "project-editor/store";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { LVGLStylesEditorRuntime } from "project-editor/lvgl/page-runtime";
import { Checkbox } from "project-editor/ui-components/PropertyGrid/Checkbox";
import { Icon } from "eez-studio-ui/icon";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { LVGLStylesTreeNavigation } from "project-editor/lvgl/LVGLStylesTreeNavigation";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import {
    findBitmap,
    findFont,
    type Project
} from "project-editor/project/project";
import { getSelectorCode } from "project-editor/lvgl/style-helper";
import {
    BUILT_IN_FONTS,
    lvglPropertiesMap,
    text_font_property_info
} from "project-editor/lvgl/style-catalog";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { getLvglCoord } from "./lvgl-versions";

////////////////////////////////////////////////////////////////////////////////

export type LVGLStyleObjects = {
    [part: string]: {
        [state: string]: number;
    };
};

////////////////////////////////////////////////////////////////////////////////

const DefaultStylePropertyGridUI = observer(
    class DefaultStylePropertyGridUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get lvglStyle() {
            return this.props.objects[0] as LVGLStyle;
        }

        onChange = (value: boolean) => {
            const defaultStyles = Object.assign(
                {},
                this.context.project.lvglStyles.defaultStyles,
                {
                    [this.lvglStyle.forWidgetType]: value
                        ? this.lvglStyle.name
                        : undefined
                }
            );

            this.context.updateObject(this.context.project.lvglStyles, {
                defaultStyles
            });
        };

        render() {
            const state =
                this.context.project.lvglStyles.defaultStyles[
                    this.lvglStyle.forWidgetType
                ] == this.lvglStyle.name;

            return (
                <Checkbox
                    state={state}
                    onChange={this.onChange}
                    readOnly={false}
                    switchStyle={true}
                ></Checkbox>
            );
        }
    }
);

export class LVGLStyle extends EezObject {
    name: string;
    forWidgetType: string;
    childStyles: LVGLStyle[];
    definition: LVGLStylesDefinition;

    constructor() {
        super();

        makeObservable(this, {
            fullDefinition: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            forWidgetType: observable,
            childStyles: observable,
            definition: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "forWidgetType",
                type: PropertyType.String,
                displayValue: (style: LVGLStyle) => {
                    const componentClass = getClassesDerivedFrom(
                        ProjectEditor.getProjectStore(style),
                        ProjectEditor.LVGLWidgetClass
                    ).find(
                        componentClass =>
                            componentClass.name == style.forWidgetType
                    );
                    return componentClass
                        ? componentClass.displayName
                            ? componentClass.displayName
                            : componentClass.objectClass.classInfo
                                  .componentPaletteLabel ||
                              getComponentName(componentClass.name)
                        : style.forWidgetType;
                },
                readOnlyInPropertyGrid: true
            },
            {
                name: "childStyles",
                type: PropertyType.Array,
                typeClass: LVGLStyle,
                hideInPropertyGrid: true
            },
            {
                name: "defaultStyle",
                type: PropertyType.Any,
                computed: true,
                propertyGridColumnComponent: DefaultStylePropertyGridUI
            },
            {
                name: "definition",
                type: PropertyType.Object,
                typeClass: LVGLStylesDefinition,
                propertyGridRowComponent: LVGLStylesDefinitionProperty,
                enumerable: false
            }
        ],
        listLabel: (lvglStyle: LVGLStyle) => {
            const componentClass = getClassesDerivedFrom(
                ProjectEditor.getProjectStore(lvglStyle),
                ProjectEditor.LVGLWidgetClass
            ).find(
                componentClass => componentClass.name == lvglStyle.forWidgetType
            );

            const icon = componentClass?.objectClass.classInfo.icon;

            const isDefault =
                ProjectEditor.getProject(lvglStyle).lvglStyles.defaultStyles[
                    lvglStyle.forWidgetType
                ] == lvglStyle.name;

            return (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flex: 1,
                        paddingRight: 10
                    }}
                >
                    <div>
                        {icon && (
                            <Icon
                                icon={icon as any}
                                style={{
                                    opacity: 0.66,
                                    marginRight: 5,
                                    height: 20
                                }}
                            />
                        )}
                        {lvglStyle.name}
                    </div>
                    {lvglStyle.redundantModifications.length > 0 && (
                        <div>
                            {lvglStyle.redundantModifications.length} redundant
                            {lvglStyle.redundantModifications.length == 1
                                ? " modification"
                                : " modifications"}
                        </div>
                    )}
                    {isDefault && <div>Default</div>}
                </div>
            );
        },
        newItem: async (parent: IEezObject) => {
            const project = ProjectEditor.getProject(parent);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Style",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "forWidgetType",
                            type: "enum",
                            enumItems: () => {
                                return getClassesDerivedFrom(
                                    project._store,
                                    ProjectEditor.LVGLWidgetClass
                                ).map(componentClass => {
                                    const classInfo =
                                        componentClass.objectClass.classInfo;
                                    return {
                                        id: componentClass.name,
                                        label: componentClass.displayName
                                            ? componentClass.displayName
                                            : classInfo.componentPaletteLabel ||
                                              getComponentName(
                                                  componentClass.name
                                              )
                                    };
                                });
                            },
                            validators: [validators.required]
                        }
                    ]
                },
                values: {
                    forWidgetType: "LVGLPanelWidget"
                }
            });

            const styleProperties: Partial<LVGLStyle> = {
                name: result.values.name,
                forWidgetType: result.values.forWidgetType,
                definition: {} as any
            };

            const style = createObject<LVGLStyle>(
                project._store,
                styleProperties,
                LVGLStyle
            );

            return style;
        },
        defaultValue: {
            forWidgetType: "LVGLPanelWidget",
            definition: {}
        },
        lvgl: (lvglStyle: LVGLStyle, project: Project) => {
            const componentClass = getClassesDerivedFrom(
                project._store,
                ProjectEditor.LVGLWidgetClass
            ).find(
                componentClass => componentClass.name == lvglStyle.forWidgetType
            );

            if (componentClass) {
                if (
                    typeof componentClass.objectClass.classInfo.lvgl ==
                    "function"
                ) {
                    return componentClass.objectClass.classInfo.lvgl(
                        lvglStyle,
                        project
                    );
                } else if (componentClass.objectClass.classInfo.lvgl) {
                    return componentClass.objectClass.classInfo.lvgl;
                }
            }

            return {
                parts: [],
                defaultFlags: "",
                states: []
            };
        },
        check: (style: LVGLStyle, messages: IMessage[]) => {
            style.definition.check(messages);
        },
        showTreeCollapseIcon: "has-children",
        extendContextMenu(
            thisObject: LVGLStyle,
            context,
            objects,
            menuItems,
            editable
        ) {
            if (thisObject.redundantModifications.length > 0) {
                menuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );
                menuItems.push(
                    new MenuItem({
                        label: "Remove Redundant Modifications",
                        click: () => {
                            thisObject.removeRedundantModifications();
                        }
                    })
                );
            }
        }
    };

    get parentStyle(): LVGLStyle | undefined {
        const object = getParent(getParent(this));
        if (object && object instanceof LVGLStyle) {
            return object;
        }
        return undefined;
    }

    get redundantModifications() {
        function getValue(
            style: LVGLStyle,
            part: string,
            state: string,
            propertyName: string
        ): any {
            const definition = style.definition.definition;
            const value = definition?.[part]?.[state]?.[propertyName];
            if (value == undefined && style.parentStyle) {
                return getValue(style.parentStyle, part, state, propertyName);
            }
            return value;
        }

        const redundantModifications: {
            part: string;
            state: string;
            propertyName: string;
        }[] = [];

        const definition = this.definition.definition || {};
        Object.keys(definition).forEach(part => {
            Object.keys(definition[part]).forEach(state => {
                Object.keys(definition[part][state]).forEach(propertyName => {
                    const value = definition[part][state][propertyName];
                    if (
                        value != undefined &&
                        this.parentStyle &&
                        value ==
                            getValue(
                                this.parentStyle,
                                part,
                                state,
                                propertyName
                            )
                    ) {
                        redundantModifications.push({
                            part,
                            state,
                            propertyName
                        });
                    }
                });
            });
        });

        return redundantModifications;
    }

    removeRedundantModifications() {
        ProjectEditor.getProjectStore(this).updateObject(this.definition, {
            definition: this.definition.removeModifications(
                this.redundantModifications
            )
        });
    }

    get fullDefinition() {
        let fullDefinition = toJS(this.definition.definition);

        if (this.parentStyle) {
            const parentDefinition = this.parentStyle.fullDefinition;

            if (parentDefinition) {
                Object.keys(parentDefinition).forEach(part => {
                    Object.keys(parentDefinition[part]).forEach(state => {
                        Object.keys(parentDefinition[part][state]).forEach(
                            propertyName => {
                                if (!fullDefinition) {
                                    fullDefinition = {};
                                }
                                if (!fullDefinition[part]) {
                                    fullDefinition[part] = {};
                                }
                                if (!fullDefinition[part][state]) {
                                    fullDefinition[part][state] = {};
                                }

                                if (
                                    fullDefinition[part][state][propertyName] ==
                                    undefined
                                ) {
                                    fullDefinition[part][state][propertyName] =
                                        parentDefinition[part][state][
                                            propertyName
                                        ];
                                }
                            }
                        );
                    });
                });
            }
        }

        return fullDefinition;
    }

    lvglCreateLocalStyles(
        runtime: LVGLPageRuntime,
        widget: LVGLWidget,
        obj: number
    ) {
        if (this.parentStyle) {
            this.parentStyle.lvglCreateLocalStyles(runtime, widget, obj);
        }
        this.definition.lvglCreate(runtime, widget, obj);
    }

    lvglCreateStyles(runtime: LVGLPageRuntime) {
        const lvglStyleObjects: LVGLStyleObjects = {};

        const project = ProjectEditor.getProject(runtime.page);
        const lvglVersion = project.settings.general.lvglVersion;

        const definition = this.fullDefinition;

        if (definition) {
            Object.keys(definition).forEach(part => {
                Object.keys(definition[part]).forEach(state => {
                    let styleObj: number | undefined;

                    function getStyleObj() {
                        if (!styleObj) {
                            styleObj = runtime.wasm._lvglStyleCreate();
                        }
                        return styleObj;
                    }

                    Object.keys(definition[part][state]).forEach(
                        propertyName => {
                            const propertyInfo =
                                lvglPropertiesMap.get(propertyName);
                            if (
                                !propertyInfo ||
                                propertyInfo.lvglStyleProp.code[lvglVersion] ==
                                    undefined
                            ) {
                                return;
                            }

                            const value = definition[part][state][propertyName];

                            if (propertyInfo.type == PropertyType.ThemedColor) {
                                runtime.lvglSetAndUpdateStyleColor(
                                    value,
                                    (wasm, colorNum) => {
                                        wasm._lvglStyleSetPropColor(
                                            getStyleObj(),
                                            runtime.getLvglStylePropCode(
                                                propertyInfo.lvglStyleProp.code
                                            ),
                                            colorNum
                                        );
                                    }
                                );
                            } else if (
                                propertyInfo.type == PropertyType.Number ||
                                propertyInfo.type == PropertyType.Enum
                            ) {
                                if (propertyInfo == text_font_property_info) {
                                    const index = BUILT_IN_FONTS.indexOf(value);
                                    if (index != -1) {
                                        runtime.wasm._lvglSetStylePropBuiltInFont(
                                            getStyleObj(),
                                            runtime.getLvglStylePropCode(
                                                propertyInfo.lvglStyleProp.code
                                            ),
                                            index
                                        );
                                    } else {
                                        const font = findFont(project, value);

                                        if (font) {
                                            const fontPtr =
                                                runtime.getFontPtr(font);
                                            if (fontPtr) {
                                                runtime.wasm._lvglSetStylePropPtr(
                                                    getStyleObj(),
                                                    runtime.getLvglStylePropCode(
                                                        propertyInfo
                                                            .lvglStyleProp.code
                                                    ),
                                                    fontPtr
                                                );
                                            }
                                        }
                                    }
                                } else {
                                    const numValue = propertyInfo.lvglStyleProp
                                        .valueToNum
                                        ? propertyInfo.lvglStyleProp.valueToNum(
                                              value,
                                              runtime
                                          )
                                        : value;

                                    runtime.wasm._lvglSetStylePropNum(
                                        getStyleObj(),
                                        runtime.getLvglStylePropCode(
                                            propertyInfo.lvglStyleProp.code
                                        ),
                                        numValue
                                    );
                                }
                            } else if (
                                propertyInfo.type ==
                                PropertyType.NumberArrayAsString
                            ) {
                                const arrValue: number[] = propertyInfo
                                    .lvglStyleProp.valueToNum
                                    ? propertyInfo.lvglStyleProp.valueToNum(
                                          value,
                                          runtime
                                      )
                                    : value;

                                const { LV_COORD_MAX } = getLvglCoord(this);
                                const LV_GRID_TEMPLATE_LAST = LV_COORD_MAX;

                                arrValue.push(LV_GRID_TEMPLATE_LAST);

                                runtime.wasm._lvglSetStylePropPtr(
                                    getStyleObj(),
                                    runtime.getLvglStylePropCode(
                                        propertyInfo.lvglStyleProp.code
                                    ),
                                    runtime.allocateInt32Array(arrValue, true)
                                );
                            } else if (
                                propertyInfo.type == PropertyType.Boolean
                            ) {
                                const numValue = value ? 1 : 0;

                                runtime.wasm._lvglSetStylePropNum(
                                    getStyleObj(),
                                    runtime.getLvglStylePropCode(
                                        propertyInfo.lvglStyleProp.code
                                    ),
                                    numValue
                                );
                            } else if (
                                propertyInfo.type ==
                                    PropertyType.ObjectReference &&
                                propertyInfo.referencedObjectCollectionPath ==
                                    "bitmaps"
                            ) {
                                const bitmap = findBitmap(project, value);
                                if (bitmap && bitmap.image) {
                                    const bitmapPtr =
                                        runtime.getBitmapPtr(bitmap);
                                    if (bitmapPtr) {
                                        runtime.wasm._lvglSetStylePropPtr(
                                            getStyleObj(),
                                            runtime.getLvglStylePropCode(
                                                propertyInfo.lvglStyleProp.code
                                            ),
                                            bitmapPtr
                                        );
                                    }
                                }
                            }
                        }
                    );

                    if (styleObj) {
                        if (!lvglStyleObjects[part]) {
                            lvglStyleObjects[part] = {};
                        }

                        lvglStyleObjects[part][state] = styleObj;
                    }
                });
            });
        }

        return lvglStyleObjects;
    }

    lvglDeleteStyles(runtime: LVGLPageRuntime, styles: LVGLStyleObjects) {
        Object.keys(styles).forEach(part => {
            Object.keys(styles[part]).forEach(state => {
                runtime.wasm._lvglStyleDelete(styles[part][state]);
            });
        });
    }

    lvglAddStyleToObject(runtime: LVGLPageRuntime, obj: number) {
        const lvglStyleObjects = runtime.styleObjMap.get(this) || {};

        Object.keys(lvglStyleObjects).forEach(part => {
            Object.keys(lvglStyleObjects[part]).forEach(state => {
                const selectorCode = getSelectorCode(this, part, state);
                runtime.wasm._lvglObjAddStyle(
                    obj,
                    lvglStyleObjects[part][state],
                    selectorCode
                );
            });
        });
    }

    lvglRemoveStyleFromObject(runtime: LVGLPageRuntime, obj: number) {
        const lvglStyleObjects = runtime.styleObjMap.get(this) || {};

        Object.keys(lvglStyleObjects).forEach(part => {
            Object.keys(lvglStyleObjects[part]).forEach(state => {
                const selectorCode = getSelectorCode(this, part, state);
                runtime.wasm._lvglObjRemoveStyle(
                    obj,
                    lvglStyleObjects[part][state],
                    selectorCode
                );
            });
        });
    }
}

registerClass("LVGLStyle", LVGLStyle);

////////////////////////////////////////////////////////////////////////////////

export class LVGLStyles extends EezObject {
    styles: LVGLStyle[];
    defaultStyles: {
        [widgetType: string]: string;
    };

    constructor() {
        super();

        makeObservable(this, {
            lvglRuntime: computed({ keepAlive: true }),
            allStyles: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            styles: observable,
            defaultStyles: observable
        });
    }

    static classInfo: ClassInfo = {
        label: () => "Styles",
        properties: [
            {
                name: "styles",
                type: PropertyType.Array,
                typeClass: LVGLStyle
            },
            {
                name: "defaultStyles",
                type: PropertyType.Any
            }
        ],
        beforeLoadHook: (object: LVGLStyles, jsObject: Partial<LVGLStyles>) => {
            if (jsObject.defaultStyles == undefined) {
                jsObject.defaultStyles = {};
            }
        },
        defaultValue: {
            styles: [],
            defaultStyles: {}
        },
        icon: "material:format_color_fill"
    };

    get lvglRuntime() {
        return new LVGLStylesEditorRuntime(ProjectEditor.getProject(this));
    }

    get allStyles() {
        const styles: LVGLStyle[] = [];

        function addStyles(style: LVGLStyle) {
            styles.push(style);
            for (const childStyle of style.childStyles) {
                addStyles(childStyle);
            }
        }

        for (const style of this.styles) {
            addStyles(style);
        }

        return styles;
    }
}

registerClass("LVGLStyles", LVGLStyles);

export const LVGLStylesNavigation = observer(
    class LVGLStylesNavigation extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "styles") {
                return (
                    <LVGLStylesTreeNavigation
                        id={"lvgl-styles"}
                        navigationObject={
                            this.context.project.lvglStyles.styles
                        }
                        selectedObject={
                            this.context.navigationStore.selectedStyleObject
                        }
                    />
                );
            }

            if (component === "preview") {
                return <LVGLSelectedStyleEditor />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayoutContainer
                    model={this.context.layoutModels.lvglStyles}
                    factory={this.factory}
                />
            );
        }
    }
);

export const LVGLSelectedStyleEditor = observer(
    class LVGLSelectedStyleEditor extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        canvasRef = React.createRef<HTMLCanvasElement>();

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selectedStyle: computed
            });
        }

        get runtime() {
            return this.context.project.lvglStyles.lvglRuntime;
        }

        get selectedStyle() {
            const navigationStore = this.context.navigationStore;

            if (navigationStore.selectedPanel) {
                if (
                    navigationStore.selectedPanel.selectedObject instanceof
                    LVGLStyle
                ) {
                    return navigationStore.selectedPanel.selectedObject;
                }
            }

            return navigationStore.selectedStyleObject.get() as LVGLStyle;
        }

        componentDidMount() {
            this.runtime.setSelectedStyle(
                this.selectedStyle,
                this.canvasRef.current
            );
        }

        componentDidUpdate() {
            this.runtime.setSelectedStyle(
                this.selectedStyle,
                this.canvasRef.current
            );
        }

        componentWillUnmount() {
            this.runtime.setSelectedStyle(undefined, null);
        }

        render() {
            this.selectedStyle;
            this.context.project.settings.general.lvglVersion;

            return (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        padding: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <canvas
                        ref={this.canvasRef}
                        width={this.runtime.displayWidth}
                        height={this.runtime.displayHeight}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%"
                        }}
                    ></canvas>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-lvgl-style",
    version: "0.1.0",
    description: "Styles support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Styles",
    mandatory: true,
    key: "lvglStyles",
    type: PropertyType.Object,
    typeClass: LVGLStyles,
    icon: "material:format_color_fill",
    create: () => {
        styles: [];
    }
};

export default feature;
