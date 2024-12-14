import { humanize } from "eez-studio-shared/string";
import { observer } from "mobx-react";
import { computed, makeObservable, runInAction } from "mobx";
import classNames from "classnames";
import { intersection } from "lodash";

import {
    getClassInfoLvglParts,
    IEezObject,
    PropertyInfo,
    PropertyProps,
    LVGLParts,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import type { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getAncestorOfType, Section } from "project-editor/store";
import React from "react";
import { LVGLStylesDefinition } from "project-editor/lvgl/style-definition";
import {
    isLvglStylePropertySupported,
    lvglProperties,
    LVGLPropertiesGroup,
    LVGLPropertyInfo,
    PropertyValueHolder
} from "project-editor/lvgl/style-catalog";
import { getStylePropDefaultValue } from "project-editor/lvgl/style-helper";
import { ProjectContext } from "project-editor/project/context";
import { Icon } from "eez-studio-ui/icon";
import {
    LVGLPageRuntime,
    LVGLStylesEditorRuntime
} from "project-editor/lvgl/page-runtime";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Checkbox } from "project-editor/ui-components/PropertyGrid/Checkbox";
import { LVGL_STYLE_STATES } from "project-editor/lvgl/lvgl-constants";

type TreeNodeData =
    | {
          part: LVGLParts;
          state: string;
      }
    | undefined;

export const LVGLStylesDefinitionProperty = observer(
    class LVGLStylesDefinitionProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                lvglPart: computed,
                lvglState: computed
            });
        }

        get lvglPart() {
            let part: LVGLParts | undefined =
                this.context.uiStateStore.lvglPart;

            if (part) {
                this.props.objects.forEach(object => {
                    const parts = getClassInfoLvglParts(object);
                    if (part && parts.indexOf(part) == -1) {
                        part = undefined;
                    }
                });
            }

            return part || "MAIN";
        }

        get lvglState() {
            return this.context.uiStateStore.lvglState;
        }

        isExpanded = (propertiesGroup: LVGLPropertiesGroup) => {
            return (
                this.context.uiStateStore.lvglExpandedPropertiesGroup.indexOf(
                    propertiesGroup.groupName
                ) != -1
            );
        };

        toggleExpanded = (propertiesGroup: LVGLPropertiesGroup) => {
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

        render() {
            const projectStore = ProjectEditor.getProject(
                this.props.objects[0]
            )._store;

            const stylesDefinitions = this.props.objects.map(
                widget =>
                    (widget as any)[
                        this.props.propertyInfo.name
                    ] as LVGLStylesDefinition
            );

            let runtime: LVGLPageRuntime | undefined;
            {
                const object = this.props.objects[0];
                if (object instanceof ProjectEditor.LVGLWidgetClass) {
                    const page = getAncestorOfType(
                        object,
                        ProjectEditor.PageClass.classInfo
                    ) as Page;
                    runtime = page && page._lvglRuntime;
                } else if (object instanceof ProjectEditor.LVGLStyleClass) {
                    runtime = projectStore.project.lvglStyles.lvglRuntime;
                }
            }

            const part = this.lvglPart;
            const state = this.lvglState;

            return (
                <div className="EezStudio_LVGLStylesDefinition">
                    <div>
                        <LVGLStylesDefinitionTree
                            stylesDefinitions={stylesDefinitions}
                            {...this.props}
                        />
                    </div>
                    <div>
                        {lvglProperties.map(propertiesGroup => {
                            const expanded = this.isExpanded(propertiesGroup);

                            const numModifications =
                                getNumModificationsForPropertiesGroup(
                                    this.props.objects,
                                    this.props.propertyInfo,
                                    part,
                                    state,
                                    propertiesGroup
                                );

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
                                                modified: numModifications > 0,
                                                inError:
                                                    stylesDefinitions.length ===
                                                        1 &&
                                                    isPropertyInError(
                                                        stylesDefinitions[0],
                                                        part,
                                                        state,
                                                        propertiesGroup.properties
                                                    )
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
                                        <LVGLStylesDefinitionGroupProperties
                                            objects={this.props.objects}
                                            propertiesGroup={propertiesGroup}
                                            stylesDefinitions={
                                                stylesDefinitions
                                            }
                                            part={part}
                                            state={state}
                                            runtime={
                                                runtime as LVGLStylesEditorRuntime
                                            }
                                            readOnly={this.props.readOnly}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
    }
);

export const LVGLStylesDefinitionTree = observer(
    class LVGLStylesDefinitionTree extends React.Component<
        { stylesDefinitions: LVGLStylesDefinition[] } & PropertyProps
    > {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                lvglPart: computed,
                lvglState: computed
            });
        }

        get lvglPart() {
            let part: LVGLParts | undefined =
                this.context.uiStateStore.lvglPart;

            if (part) {
                this.props.objects.forEach(object => {
                    const parts = getClassInfoLvglParts(object);
                    if (part && parts.indexOf(part) == -1) {
                        part = undefined;
                    }
                });
            }

            return part || "MAIN";
        }

        get lvglState() {
            return this.context.uiStateStore.lvglState;
        }

        getNumModificationsForPart(part: LVGLParts) {
            let result = 0;

            for (const state of LVGL_STYLE_STATES) {
                for (const propertiesGroup of lvglProperties) {
                    result += getNumModificationsForPropertiesGroup(
                        this.props.objects,
                        this.props.propertyInfo,
                        part,
                        state,
                        propertiesGroup
                    );
                }
            }
            return result;
        }

        getNumModificationsForPartAndState(part: LVGLParts, state: string) {
            let result = 0;
            for (const propertiesGroup of lvglProperties) {
                result += getNumModificationsForPropertiesGroup(
                    this.props.objects,
                    this.props.propertyInfo,
                    part,
                    state,
                    propertiesGroup
                );
            }
            return result;
        }

        get rootNode(): ITreeNode<TreeNodeData> {
            let parts: LVGLParts[] | undefined;

            this.props.objects.forEach(widget => {
                const widgetParts = getClassInfoLvglParts(widget);

                if (parts == undefined) {
                    parts = widgetParts;
                } else {
                    parts = intersection(parts, widgetParts);
                }
            });

            return {
                id: "root",
                label: "Root",
                children:
                    parts?.map(part => {
                        const numModifications =
                            this.getNumModificationsForPart(part);

                        const partLabel = humanize(part) + " part";

                        return {
                            id: part,
                            label: (
                                <span
                                    className={classNames(
                                        "EezStudio_LVGLStyle_PartLabel",
                                        {
                                            inError:
                                                this.props.stylesDefinitions
                                                    .length === 1 &&
                                                isPropertyInError(
                                                    this.props
                                                        .stylesDefinitions[0],
                                                    part
                                                )
                                        }
                                    )}
                                >
                                    {numModifications == 0
                                        ? partLabel
                                        : `${partLabel} (${numModifications})`}
                                </span>
                            ),
                            children: LVGL_STYLE_STATES.map(state => {
                                const numModifications =
                                    this.getNumModificationsForPartAndState(
                                        part,
                                        state
                                    );
                                return {
                                    id: state,
                                    label: (
                                        <span
                                            className={classNames(
                                                "EezStudio_LVGLStyle_StateLabel",
                                                {
                                                    inError:
                                                        this.props
                                                            .stylesDefinitions
                                                            .length === 1 &&
                                                        isPropertyInError(
                                                            this.props
                                                                .stylesDefinitions[0],
                                                            part,
                                                            state
                                                        )
                                                }
                                            )}
                                        >
                                            {numModifications == 0
                                                ? state
                                                : `${state} (${numModifications})`}
                                        </span>
                                    ),
                                    children: [],
                                    selected:
                                        this.lvglPart == part &&
                                        this.lvglState == state,
                                    expanded: false,
                                    data: { part, state },
                                    className: classNames("state", {
                                        modified: numModifications > 0
                                    })
                                };
                            }),
                            selected: false,
                            expanded: true,
                            className: classNames("part", {
                                modified: numModifications > 0
                            })
                        };
                    }) ?? [],
                selected: false,
                expanded: true
            };
        }

        selectNode = (node: ITreeNode<TreeNodeData>) => {
            const treeNodeData = node.data;
            if (treeNodeData != undefined) {
                runInAction(() => {
                    this.context.uiStateStore.lvglPart = treeNodeData.part;
                    this.context.uiStateStore.lvglState = treeNodeData.state;
                });
            }
        };

        render() {
            return (
                <Tree
                    showOnlyChildren={true}
                    rootNode={this.rootNode}
                    selectNode={this.selectNode}
                    collapsable={true}
                    rowPadding={5}
                ></Tree>
            );
        }
    }
);

export const LVGLStylesDefinitionGroupProperties = observer(
    class GroupProperties extends React.Component<{
        objects: IEezObject[];
        propertiesGroup: LVGLPropertiesGroup;
        stylesDefinitions: LVGLStylesDefinition[];
        part: LVGLParts;
        state: string;
        runtime: LVGLStylesEditorRuntime;
        readOnly: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const {
                objects,
                propertiesGroup,
                stylesDefinitions,
                part,
                state,
                readOnly,
                runtime
            } = this.props;

            return (
                <div className="EezStudio_LVGLStylesDefinition_GroupProperties">
                    {propertiesGroup.properties
                        .filter(propertyInfo =>
                            isLvglStylePropertySupported(
                                this.context.project,
                                propertyInfo
                            )
                        )
                        .map(propertyInfo => {
                            let definedValues = stylesDefinitions.map(
                                stylesDefinition =>
                                    stylesDefinition.getPropertyValue(
                                        propertyInfo,
                                        part,
                                        state
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

                            const values: any[] = definedValues.map(
                                (definedValue, i) => {
                                    const object = objects[i];

                                    let lvglObj: number | undefined;

                                    if (
                                        object instanceof
                                        ProjectEditor.LVGLWidgetClass
                                    ) {
                                        lvglObj = object._lvglObj;
                                    } else if (
                                        object instanceof
                                        ProjectEditor.LVGLStyleClass
                                    ) {
                                        lvglObj = runtime.getLvglObj(object);
                                    }

                                    return definedValue !== undefined
                                        ? definedValue
                                        : getStylePropDefaultValue(
                                              runtime,
                                              lvglObj,
                                              part,
                                              state,
                                              propertyInfo
                                          );
                                }
                            );

                            const propertyObjects = values.map(
                                value =>
                                    new PropertyValueHolder(
                                        this.context,
                                        propertyInfo.name,
                                        value
                                    )
                            );

                            const propertyName = getObjectPropertyDisplayName(
                                propertyObjects[0],
                                propertyInfo
                            );

                            return (
                                <div
                                    key={propertyInfo.name}
                                    className={classNames(
                                        "EezStudio_LVGLStylesDefinition_Property",
                                        {
                                            inError:
                                                stylesDefinitions.length ===
                                                    1 &&
                                                isPropertyInError(
                                                    stylesDefinitions[0],
                                                    part,
                                                    state,
                                                    [propertyInfo]
                                                )
                                        }
                                    )}
                                >
                                    <div className="EezStudio_LVGLStylesDefinition_Name for-check">
                                        <label className="form-check-label">
                                            <Checkbox
                                                state={checkboxState}
                                                onChange={checked => {
                                                    this.context.undoManager.setCombineCommands(
                                                        true
                                                    );

                                                    if (checked) {
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
                                                readOnly={readOnly}
                                            />
                                            <span title={propertyName}>
                                                {" " + propertyName}
                                            </span>
                                        </label>
                                    </div>
                                    <div className="EezStudio_LVGLStylesDefinition_Value">
                                        <ProjectEditor.Property
                                            propertyInfo={propertyInfo}
                                            objects={propertyObjects}
                                            updateObject={(
                                                propertyValues: Object
                                            ) => {
                                                let newPropertyValue = (
                                                    propertyValues as any
                                                )[propertyInfo.name];

                                                stylesDefinitions.forEach(
                                                    (stylesDefinition, i) => {
                                                        this.context.updateObject(
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
                                            }}
                                            readOnly={
                                                readOnly ||
                                                checkboxState !== true
                                            }
                                            onClick={() => {
                                                if (!checkboxState) {
                                                    this.context.undoManager.setCombineCommands(
                                                        true
                                                    );

                                                    stylesDefinitions.forEach(
                                                        (
                                                            stylesDefinition,
                                                            i
                                                        ) => {
                                                            if (
                                                                definedValues[
                                                                    i
                                                                ] === undefined
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

                                                    this.context.undoManager.setCombineCommands(
                                                        false
                                                    );
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                </div>
            );
        }
    }
);

function getNumModificationsForPropertiesGroup(
    objects: IEezObject[],
    propertyInfo: PropertyInfo,
    part: LVGLParts,
    state: string,
    propertiesGroup: LVGLPropertiesGroup
) {
    let result = 0;

    const stylesDefinitions = objects.map(
        widget => (widget as any)[propertyInfo.name] as LVGLStylesDefinition
    );

    for (const propertyInfo of propertiesGroup.properties) {
        if (!isLvglStylePropertySupported(objects[0], propertyInfo)) {
            continue;
        }

        let definedValues = stylesDefinitions.map(stylesDefinition =>
            stylesDefinition.getPropertyValue(propertyInfo, part, state)
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
            numDefined == 0 ? false : numUndefined == 0 ? true : undefined;

        if (checkboxState !== false) {
            result++;
        }
    }
    return result;
}

function isPropertyInError(
    stylesDefinition: LVGLStylesDefinition,
    part: LVGLParts,
    state?: string,
    propertyInfoArray?: LVGLPropertyInfo[]
) {
    return ProjectEditor.getProjectStore(stylesDefinition)
        .outputSectionsStore.getSection(Section.CHECKS)
        .messages.isLVGLStylePropertyInError(
            stylesDefinition,
            part,
            state,
            propertyInfoArray
        );
}
