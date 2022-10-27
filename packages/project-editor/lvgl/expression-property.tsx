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
import { getClassInfo } from "project-editor/store";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";
import { expressionBuilder } from "project-editor/flow/expression/ExpressionBuilder";
import type { LVGLLabelWidget } from "project-editor/lvgl/widgets";
import { ProjectEditor } from "project-editor/project-editor-interface";

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
            const classInfo = getClassInfo(this.props.objects[0]);

            const typePropertyInfo = findPropertyByNameInClassInfo(
                classInfo,
                this.props.propertyInfo.name + "Type"
            )!;

            const type: LVGLPropertyType = (this.props.objects[0] as any)[
                typePropertyInfo.name
            ];

            let propertyInfoType = this.props.propertyInfo.type;
            let referencedObjectCollectionPath =
                this.props.propertyInfo.referencedObjectCollectionPath;
            if (this.props.propertyInfo.dynamicType) {
                propertyInfoType = this.props.propertyInfo.dynamicType(
                    this.props.objects[0]
                );
            }
            if (
                this.props.propertyInfo
                    .dynamicTypeReferencedObjectCollectionPath
            ) {
                referencedObjectCollectionPath =
                    this.props.propertyInfo.dynamicTypeReferencedObjectCollectionPath(
                        this.props.objects[0]
                    );
            }

            console.log(propertyInfoType, referencedObjectCollectionPath);

            const propertyInfo = Object.assign({}, this.props.propertyInfo, {
                type:
                    type == "expression"
                        ? this.context.projectTypeTraits.hasFlowSupport
                            ? PropertyType.MultilineText
                            : PropertyType.ObjectReference
                        : propertyInfoType,

                referencedObjectCollectionPath:
                    type == "expression"
                        ? "variables/globalVariables"
                        : referencedObjectCollectionPath,

                propertyGridColumnComponent: undefined,

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
            });

            return (
                <div className="EezStudio_LVGProperty">
                    <Property
                        propertyInfo={propertyInfo}
                        objects={this.props.objects}
                        readOnly={this.props.readOnly}
                        updateObject={this.props.updateObject}
                    />

                    <Property
                        propertyInfo={typePropertyInfo}
                        objects={this.props.objects}
                        readOnly={this.props.readOnly}
                        updateObject={this.props.updateObject}
                    />
                </div>
            );
        }
    }
);

export function makeExpressionProperty(
    name: string,
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
                }
            },
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
        }
    ];
}
