import { humanize } from "eez-studio-shared/string";
import { observer } from "mobx-react";
import { EezObject, PropertyProps } from "project-editor/core/object";
import type { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getAncestorOfType } from "project-editor/store";
import React from "react";
import {
    getStylePropDefaultValue,
    lvglProperties,
    LVGLStylesDefinition
} from "project-editor/lvgl/style";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { ProjectContext } from "project-editor/project/context";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";

export type LVGLCreateResultType = {
    obj: number;
    children: LVGLCreateResultType[];
};

export const LVGLStylesDefinitionProperty = observer(
    class LVGLStylesDefinitionProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            if (this.props.objects.length != 1) {
                return null;
            }

            const widget = this.props.objects[0] as LVGLWidget;
            const stylesDefinition = (widget as any)[
                this.props.propertyInfo.name
            ] as LVGLStylesDefinition;

            const page = getAncestorOfType(
                widget,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            const runtime = page._lvglRuntime;

            const part = "main";
            const state = "default";

            return (
                <div className="EezStudio_LVGLStylesDefinition">
                    {lvglProperties.map(propertiesGroup => (
                        <div
                            key={propertiesGroup.groupName}
                            className="EezStudio_LVGLStylesDefinition_GroupContainer"
                        >
                            <div className="EezStudio_LVGLStylesDefinition_GroupName">
                                {propertiesGroup.groupName}
                            </div>
                            <div className="EezStudio_LVGLStylesDefinition_GroupProperties">
                                {propertiesGroup.properties.map(
                                    propertyInfo => {
                                        let value =
                                            stylesDefinition.getPropertyValue(
                                                propertyInfo,
                                                part,
                                                state
                                            );

                                        let isDefined;

                                        if (value !== undefined) {
                                            isDefined = true;
                                        } else {
                                            isDefined = false;
                                            value = getStylePropDefaultValue(
                                                runtime,
                                                widget,
                                                part,
                                                propertyInfo
                                            );
                                        }

                                        return (
                                            <div
                                                key={propertyInfo.name}
                                                className="EezStudio_LVGLStylesDefinition_Property"
                                            >
                                                <div className="EezStudio_LVGLStylesDefinition_Name for-check">
                                                    <label className="form-check-label">
                                                        <input
                                                            type="checkbox"
                                                            className="form-check-input"
                                                            checked={isDefined}
                                                            onChange={event => {
                                                                if (
                                                                    event.target
                                                                        .checked
                                                                ) {
                                                                    this.context.updateObject(
                                                                        stylesDefinition,
                                                                        {
                                                                            definition:
                                                                                stylesDefinition.addPropertyToDefinition(
                                                                                    propertyInfo,
                                                                                    part,
                                                                                    state,
                                                                                    value
                                                                                )
                                                                        }
                                                                    );
                                                                } else {
                                                                    this.context.updateObject(
                                                                        stylesDefinition,
                                                                        {
                                                                            definition:
                                                                                stylesDefinition.removePropertyFromDefinition(
                                                                                    propertyInfo,
                                                                                    part,
                                                                                    state
                                                                                )
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        {" " +
                                                            humanize(
                                                                propertyInfo.name
                                                            )}
                                                    </label>
                                                </div>
                                                <div className="EezStudio_LVGLStylesDefinition_Value">
                                                    <Property
                                                        propertyInfo={
                                                            propertyInfo
                                                        }
                                                        objects={[
                                                            new PropertyValueHolder(
                                                                propertyInfo.name,
                                                                value
                                                            )
                                                        ]}
                                                        updateObject={(
                                                            propertyValues: Object
                                                        ) => {
                                                            let newPropertyValue =
                                                                (
                                                                    propertyValues as any
                                                                )[
                                                                    propertyInfo
                                                                        .name
                                                                ];

                                                            const projectEditorStore =
                                                                ProjectEditor.getProject(
                                                                    widget
                                                                )._DocumentStore;

                                                            projectEditorStore.updateObject(
                                                                stylesDefinition,
                                                                {
                                                                    definition:
                                                                        stylesDefinition.addPropertyToDefinition(
                                                                            propertyInfo,
                                                                            part,
                                                                            state,
                                                                            newPropertyValue
                                                                        )
                                                                }
                                                            );
                                                        }}
                                                        readOnly={!isDefined}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
    }
);

class PropertyValueHolder extends EezObject {
    [propertyName: string]: any;
    constructor(propertyName: string, propertyValue: any) {
        super();
        this[propertyName] = propertyValue;
    }
}
