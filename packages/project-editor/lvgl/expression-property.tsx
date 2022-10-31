import React from "react";
import { observer } from "mobx-react";

import {
    EezObject,
    findPropertyByNameInClassInfo,
    FlowPropertyType,
    IEezObject,
    IOnSelectParams,
    PropertyInfo,
    PropertyProps,
    PropertyType
} from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { getAncestorOfType, getClassInfo } from "project-editor/store";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";
import { expressionBuilder } from "project-editor/flow/expression/ExpressionBuilder";
import type { LVGLLabelWidget, LVGLWidget } from "project-editor/lvgl/widgets";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getPropertyValue } from "project-editor/ui-components/PropertyGrid/utils";
import { ValueType } from "eez-studio-types";
import type { Page } from "project-editor/features/page/page";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { humanize } from "eez-studio-shared/string";
import { getComponentName } from "project-editor/flow/editor/ComponentsPalette";

export type LVGLPropertyType =
    | "literal"
    | "expression"
    | "variable"
    | "text-resource";

const LVGLProperty = observer(
    class LVGLProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const { propertyInfo, objects, updateObject, readOnly } =
                this.props;

            const classInfo = getClassInfo(this.props.objects[0]);

            const typePropertyInfo = findPropertyByNameInClassInfo(
                classInfo,
                propertyInfo.name + "Type"
            )!;

            const type: LVGLPropertyType = (objects[0] as any)[
                typePropertyInfo.name
            ];

            let propertyInfoType;
            if (propertyInfo.dynamicType) {
                propertyInfoType = propertyInfo.dynamicType(objects[0]);
            } else {
                propertyInfoType =
                    propertyInfo.expressionType == "integer"
                        ? PropertyType.Number
                        : propertyInfo.expressionType == "string"
                        ? PropertyType.MultilineText
                        : propertyInfo.expressionType == "boolean"
                        ? PropertyType.Boolean
                        : propertyInfo.type;
            }

            let referencedObjectCollectionPath =
                propertyInfo.referencedObjectCollectionPath;
            if (propertyInfo.dynamicTypeReferencedObjectCollectionPath) {
                referencedObjectCollectionPath =
                    propertyInfo.dynamicTypeReferencedObjectCollectionPath(
                        objects[0]
                    );
            }

            const valuePropertyInfo = Object.assign({}, propertyInfo, {
                type:
                    type == "expression"
                        ? this.context.projectTypeTraits.hasFlowSupport
                            ? PropertyType.MultilineText
                            : PropertyType.ObjectReference
                        : propertyInfoType,

                checkboxStyleSwitch: true,

                referencedObjectCollectionPath:
                    type == "expression"
                        ? "variables/globalVariables"
                        : referencedObjectCollectionPath,

                propertyGridColumnComponent: undefined,

                disableBitmapPreview: true,

                onSelect:
                    type == "expression"
                        ? (
                              object: IEezObject,
                              propertyInfo: PropertyInfo,
                              params: IOnSelectParams
                          ) =>
                              expressionBuilder(
                                  object,
                                  propertyInfo,
                                  {
                                      assignableExpression: false,
                                      title: "Expression Builder"
                                  },
                                  params
                              )
                        : undefined,
                isOnSelectAvailable: () => {
                    return this.context.projectTypeTraits.hasFlowSupport;
                }
            } as Partial<PropertyInfo>);

            let bitmap;
            if (referencedObjectCollectionPath === "bitmaps") {
                const getPropertyValueResult = getPropertyValue(
                    objects,
                    propertyInfo
                );
                if (getPropertyValueResult) {
                    bitmap = ProjectEditor.findBitmap(
                        this.context.project,
                        getPropertyValueResult.value
                    );
                }
            }

            return (
                <>
                    <div className="EezStudio_LVGProperty">
                        <Property
                            propertyInfo={valuePropertyInfo}
                            objects={objects}
                            readOnly={readOnly}
                            updateObject={updateObject}
                        />

                        <Property
                            propertyInfo={typePropertyInfo}
                            objects={objects}
                            readOnly={readOnly}
                            updateObject={updateObject}
                        />
                    </div>
                    {bitmap && bitmap.imageSrc && (
                        <img
                            className="EezStudio_Property_BitmapPreview"
                            src={bitmap.imageSrc}
                        />
                    )}
                </>
            );
        }
    }
);

export function makeExpressionProperty(
    name: string,
    expressionType: ValueType,
    flowProperty: FlowPropertyType,
    types: LVGLPropertyType[],
    props: Partial<PropertyInfo>
) {
    return [
        Object.assign(
            {
                name,
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "variables/globalVariables",
                propertyGridColumnComponent: LVGLProperty,
                flowProperty: (widget: LVGLLabelWidget | undefined) => {
                    if (widget == undefined) {
                        return flowProperty;
                    }
                    return (widget as any)[name + "Type"] == "expression"
                        ? flowProperty
                        : undefined;
                },
                expressionType
            } as PropertyInfo,
            props
        ),
        {
            name: name + "Type",
            type: PropertyType.Enum,
            enumItems: (object: EezObject) =>
                types.map(id => ({
                    id,
                    label:
                        !ProjectEditor.getProject(object).projectTypeTraits
                            .hasFlowSupport && id == "expression"
                            ? "Variable"
                            : undefined
                })),
            enumDisallowUndefined: true,
            propertyGridGroup: props.propertyGridGroup,
            hideInPropertyGrid: true
        } as PropertyInfo
    ];
}

export function expressionPropertyBuildTickSpecific<T extends LVGLWidget>(
    build: LVGLBuild,
    widget: T,
    propName: Extract<keyof T, string>,
    getFunc: string,
    setFunc: string,
    setFuncOptArgs?: string
) {
    if ((widget as any)[propName + "Type"] == "expression") {
        const propertyInfo = findPropertyByNameInClassInfo(
            getClassInfo(widget),
            propName
        );
        if (!propertyInfo) {
            console.error("UNEXPECTED!");
            return;
        }

        build.line(`{`);
        build.indent();

        if (build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport) {
            const page = getAncestorOfType(
                widget,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let flowIndex = build.assets.getFlowIndex(page);
            let componentIndex = build.assets.getComponentIndex(widget);
            const propertyIndex = build.assets.getComponentPropertyIndex(
                widget,
                propName
            );

            if (propertyInfo.expressionType == "string") {
                build.line(
                    `const char *new_val = evalTextProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Text in Label widget");`
                );
            } else if (propertyInfo.expressionType == "integer") {
                build.line(
                    `int32_t new_val = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value in Slider widget");`
                );
            } else {
                console.error("UNEXPECTED!");
                return;
            }
        } else {
            if (propertyInfo.expressionType == "string") {
                build.line(
                    `const char *new_val = ${build.getVariableGetterFunctionName(
                        (widget as any)[propName]
                    )}();`
                );
            } else if (propertyInfo.expressionType == "integer") {
                build.line(
                    `int32_t new_val = ${build.getVariableGetterFunctionName(
                        (widget as any)[propName]
                    )}();`
                );
            } else {
                console.error("UNEXPECTED!");
                return;
            }
        }

        if (propertyInfo.expressionType == "string") {
            build.line(
                `const char *cur_val = ${getFunc}(${build.getLvglObjectAccessor(
                    widget
                )});`
            );

            build.line(
                `if (strcmp(new_val, cur_val) != 0) ${setFunc}(${build.getLvglObjectAccessor(
                    widget
                )}, new_val${setFuncOptArgs ?? ""});`
            );
        } else if (propertyInfo.expressionType == "integer") {
            build.line(
                `int32_t cur_val = ${getFunc}(${build.getLvglObjectAccessor(
                    widget
                )});`
            );

            build.line(
                `if (new_val != cur_val) ${setFunc}(${build.getLvglObjectAccessor(
                    widget
                )}, new_val${setFuncOptArgs ?? ""});`
            );
        } else {
            console.error("UNEXPECTED!");
            return;
        }

        build.unindent();
        build.line(`}`);
    }
}

export function expressionPropertyBuildEventHandlerSpecific<
    T extends LVGLWidget
>(
    build: LVGLBuild,
    widget: T,
    propName: Extract<keyof T, string>,
    getFunc: string
) {
    if ((widget as any)[propName + "Type"] == "expression") {
        build.line("if (event == LV_EVENT_VALUE_CHANGED) {");
        build.indent();

        build.line(`lv_obj_t *ta = lv_event_get_target(e);`);
        build.line(`int32_t value = ${getFunc}(ta);`);

        if (build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport) {
            const propertyInfo = findPropertyByNameInClassInfo(
                getClassInfo(widget),
                propName
            );
            if (!propertyInfo) {
                console.error("UNEXPECTED!");
                return;
            }

            const page = getAncestorOfType(
                widget,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            let flowIndex = build.assets.getFlowIndex(page);
            let componentIndex = build.assets.getComponentIndex(widget);
            const propertyIndex = build.assets.getComponentPropertyIndex(
                widget,
                propName
            );

            if (propertyInfo.expressionType == "integer") {
                build.line(
                    `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign ${humanize(
                        propName
                    )} in ${getComponentName(widget.type)} widget");`
                );
            } else {
                console.error("UNEXPECTED!");
                return;
            }
        } else {
            build.line(
                `${build.getVariableSetterFunctionName(
                    (widget as any)[propName]
                )}(value);`
            );
        }

        build.unindent();
        build.line("}");
    }
}
