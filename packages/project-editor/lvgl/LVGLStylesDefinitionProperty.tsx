import { humanize } from "eez-studio-shared/string";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import classNames from "classnames";

import { EezObject, PropertyProps } from "project-editor/core/object";
import type { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getAncestorOfType, ProjectEditorStore } from "project-editor/store";
import React from "react";
import {
    getStylePropDefaultValue,
    lvglProperties,
    LVGLStylesDefinition,
    PropertiesGroup
} from "project-editor/lvgl/style";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { ProjectContext } from "project-editor/project/context";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";
import { Icon } from "eez-studio-ui/icon";
import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";

export type LVGLCreateResultType = {
    obj: number;
    children: LVGLCreateResultType[];
};

export const LVGLStylesDefinitionProperty = observer(
    class LVGLStylesDefinitionProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        isExpanded = (propertiesGroup: PropertiesGroup) => {
            return (
                this.context.uiStateStore.lvglExpandedPropertiesGroup.indexOf(
                    propertiesGroup.groupName
                ) != -1
            );
        };

        toggleExpanded = (propertiesGroup: PropertiesGroup) => {
            runInAction(() => {
                const i =
                    this.context.uiStateStore.lvglExpandedPropertiesGroup.indexOf(
                        propertiesGroup.groupName
                    );
                if (i == -1) {
                    this.context.uiStateStore.lvglExpandedPropertiesGroup.push(
                        propertiesGroup.groupName
                    );
                } else {
                    this.context.uiStateStore.lvglExpandedPropertiesGroup.splice(
                        i,
                        1
                    );
                }
            });
        };

        getNumModifications(propertiesGroup: PropertiesGroup) {
            let result = 0;

            const stylesDefinitions = this.props.objects.map(
                widget =>
                    (widget as any)[
                        this.props.propertyInfo.name
                    ] as LVGLStylesDefinition
            );

            for (const propertyInfo of propertiesGroup.properties) {
                let definedValues = stylesDefinitions.map(stylesDefinition =>
                    stylesDefinition.getPropertyValue(
                        propertyInfo,
                        this.context.uiStateStore.lvglPart,
                        this.context.uiStateStore.lvglState
                    )
                );

                let numDefined = 0;
                let numUndefined = 0;
                definedValues.forEach(definedValue => {
                    if (definedValue !== undefined) {
                        numDefined++;
                    } else {
                        numUndefined++;
                    }
                });

                let checkboxState =
                    numDefined == 0
                        ? false
                        : numUndefined == 0
                        ? true
                        : undefined;

                if (checkboxState !== false) {
                    result++;
                }
            }
            return result;
        }

        render() {
            const projectEditorStore = ProjectEditor.getProject(
                this.props.objects[0]
            )._DocumentStore;

            const stylesDefinitions = this.props.objects.map(
                widget =>
                    (widget as any)[
                        this.props.propertyInfo.name
                    ] as LVGLStylesDefinition
            );

            let runtime: LVGLPageRuntime | undefined;
            {
                const widget = this.props.objects[0] as LVGLWidget;
                const page = getAncestorOfType(
                    widget,
                    ProjectEditor.PageClass.classInfo
                ) as Page;
                runtime = page._lvglRuntime;
            }

            const part = this.context.uiStateStore.lvglPart;
            const state = this.context.uiStateStore.lvglState;

            return (
                <div className="EezStudio_LVGLStylesDefinition">
                    {lvglProperties.map(propertiesGroup => {
                        const expanded = this.isExpanded(propertiesGroup);
                        const numModifications =
                            this.getNumModifications(propertiesGroup);
                        return (
                            <div
                                key={propertiesGroup.groupName}
                                className="EezStudio_LVGLStylesDefinition_GroupContainer"
                            >
                                <div
                                    className={classNames(
                                        "EezStudio_LVGLStylesDefinition_GroupName",
                                        {
                                            collapsed: !expanded,
                                            modified: numModifications > 0
                                        }
                                    )}
                                    onClick={() =>
                                        this.toggleExpanded(propertiesGroup)
                                    }
                                >
                                    <Icon
                                        icon={
                                            expanded
                                                ? "material:keyboard_arrow_down"
                                                : "material:keyboard_arrow_right"
                                        }
                                        size={18}
                                        className="triangle"
                                    />
                                    {propertiesGroup.groupName}
                                    {numModifications > 0
                                        ? ` (${numModifications})`
                                        : ""}
                                </div>
                                {expanded && (
                                    <div className="EezStudio_LVGLStylesDefinition_GroupProperties">
                                        {propertiesGroup.properties.map(
                                            propertyInfo => {
                                                let definedValues =
                                                    stylesDefinitions.map(
                                                        stylesDefinition =>
                                                            stylesDefinition.getPropertyValue(
                                                                propertyInfo,
                                                                part,
                                                                state
                                                            )
                                                    );

                                                let numDefined = 0;
                                                let numUndefined = 0;
                                                definedValues.forEach(
                                                    definedValue => {
                                                        if (
                                                            definedValue !==
                                                            undefined
                                                        ) {
                                                            numDefined++;
                                                        } else {
                                                            numUndefined++;
                                                        }
                                                    }
                                                );

                                                let checkboxState =
                                                    numDefined == 0
                                                        ? false
                                                        : numUndefined == 0
                                                        ? true
                                                        : undefined;

                                                const values: any[] =
                                                    definedValues.map(
                                                        (definedValue, i) =>
                                                            definedValue !==
                                                            undefined
                                                                ? definedValue
                                                                : getStylePropDefaultValue(
                                                                      runtime,
                                                                      this.props
                                                                          .objects[
                                                                          i
                                                                      ] as LVGLWidget,
                                                                      part,
                                                                      propertyInfo
                                                                  )
                                                    );

                                                return (
                                                    <div
                                                        key={propertyInfo.name}
                                                        className="EezStudio_LVGLStylesDefinition_Property"
                                                    >
                                                        <div className="EezStudio_LVGLStylesDefinition_Name for-check">
                                                            <label className="form-check-label">
                                                                <Checkbox
                                                                    state={
                                                                        checkboxState
                                                                    }
                                                                    onChange={checked => {
                                                                        this.context.undoManager.setCombineCommands(
                                                                            true
                                                                        );

                                                                        if (
                                                                            checked
                                                                        ) {
                                                                            stylesDefinitions.forEach(
                                                                                (
                                                                                    stylesDefinition,
                                                                                    i
                                                                                ) => {
                                                                                    if (
                                                                                        definedValues[
                                                                                            i
                                                                                        ] ===
                                                                                        undefined
                                                                                    ) {
                                                                                        this.context.updateObject(
                                                                                            stylesDefinition,
                                                                                            {
                                                                                                definition:
                                                                                                    stylesDefinition.addPropertyToDefinition(
                                                                                                        propertyInfo,
                                                                                                        part,
                                                                                                        state,
                                                                                                        values[
                                                                                                            i
                                                                                                        ]
                                                                                                    )
                                                                                            }
                                                                                        );
                                                                                    }
                                                                                }
                                                                            );
                                                                        } else {
                                                                            stylesDefinitions.forEach(
                                                                                (
                                                                                    stylesDefinition,
                                                                                    i
                                                                                ) => {
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
                                                                            );
                                                                        }
                                                                        this.context.undoManager.setCombineCommands(
                                                                            false
                                                                        );
                                                                    }}
                                                                    readOnly={
                                                                        this
                                                                            .props
                                                                            .readOnly
                                                                    }
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
                                                                objects={values.map(
                                                                    value =>
                                                                        new PropertyValueHolder(
                                                                            this.context,
                                                                            propertyInfo.name,
                                                                            value
                                                                        )
                                                                )}
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

                                                                    this.context.undoManager.setCombineCommands(
                                                                        true
                                                                    );

                                                                    stylesDefinitions.forEach(
                                                                        (
                                                                            stylesDefinition,
                                                                            i
                                                                        ) => {
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
                                                                        }
                                                                    );

                                                                    this.context.undoManager.setCombineCommands(
                                                                        false
                                                                    );
                                                                }}
                                                                readOnly={
                                                                    this.props
                                                                        .readOnly ||
                                                                    checkboxState !==
                                                                        true
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }
    }
);

export class PropertyValueHolder extends EezObject {
    [propertyName: string]: any;
    constructor(
        public projectEditorStore: ProjectEditorStore,
        propertyName: string,
        propertyValue: any
    ) {
        super();
        this[propertyName] = propertyValue;
    }
}

export const Checkbox = observer(
    class Checkbox extends React.Component<{
        state: boolean | undefined;
        label?: string;
        onChange: (value: boolean) => void;
        readOnly: boolean;
    }> {
        inputRef = React.createRef<HTMLInputElement>();

        updateIndeterminate() {
            if (this.inputRef.current) {
                this.inputRef.current.indeterminate =
                    this.props.state == undefined;
            }
        }

        componentDidMount() {
            this.updateIndeterminate();
        }

        componentDidUpdate() {
            this.updateIndeterminate();
        }

        render() {
            const input = (
                <input
                    ref={this.inputRef}
                    type="checkbox"
                    className="form-check-input"
                    checked={this.props.state ? true : false}
                    onChange={event =>
                        this.props.onChange(event.target.checked)
                    }
                    disabled={this.props.readOnly}
                />
            );

            if (this.props.label === undefined) {
                return input;
            }

            return (
                <div className="form-check">
                    <label className="form-check-label">
                        {input}
                        {this.props.label}
                    </label>
                </div>
            );
        }
    }
);
