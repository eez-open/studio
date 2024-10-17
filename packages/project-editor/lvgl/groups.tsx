import React from "react";
import { observable, makeObservable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import {
    registerClass,
    PropertyType,
    EezObject,
    ClassInfo,
    IEezObject,
    PropertyProps
} from "project-editor/core/object";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { ProjectContext } from "project-editor/project/context";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { validators as validatorsRenderer } from "eez-studio-shared/validation-renderer";
import {
    createObject,
    getClassInfo,
    getProjectStore,
    objectToString
} from "project-editor/store";
import { Checkbox } from "project-editor/ui-components/PropertyGrid/Checkbox";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IListNode, List, ListItem } from "eez-studio-ui/list";
import type { Widget } from "project-editor/flow/component";

////////////////////////////////////////////////////////////////////////////////

const DefaultGroupPropertyGridUI = observer(
    class DefaultGroupPropertyGridUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get lvglGroup() {
            return this.props.objects[0] as LVGLGroup;
        }

        onChange = (value: boolean) => {
            if (value) {
                this.context.updateObject(this.context.project.lvglGroups, {
                    [this.props.propertyInfo.name]: this.lvglGroup.name
                });
            } else {
                if (
                    (this.context.project.lvglGroups as any)[
                        this.props.propertyInfo.name
                    ] === this.lvglGroup.name
                ) {
                    this.context.updateObject(this.context.project.lvglGroups, {
                        [this.props.propertyInfo.name]: ""
                    });
                }
            }
        };

        render() {
            const state =
                (this.context.project.lvglGroups as any)[
                    this.props.propertyInfo.name
                ] === this.lvglGroup.name;

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

////////////////////////////////////////////////////////////////////////////////

export class LVGLGroup extends EezObject {
    name: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "defaultGroupForEncoderInSimulator",
                displayName: "Use this for Encoder in simulator",
                type: PropertyType.Any,
                computed: true,
                propertyGridColumnComponent: DefaultGroupPropertyGridUI
            },
            {
                name: "defaultGroupForKeyboardInSimulator",
                displayName: "Use this for Keyboard in simulator",
                type: PropertyType.Any,
                computed: true,
                propertyGridColumnComponent: DefaultGroupPropertyGridUI
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Group",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator
                            ]
                        }
                    ]
                },
                values: {}
            });

            const projectStore = getProjectStore(parent);

            const properties: Partial<LVGLGroup> = Object.assign({
                name: result.values.name
            });

            const group = createObject<LVGLGroup>(
                projectStore,
                properties,
                LVGLGroup
            );

            return group;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable
        });
    }
}

registerClass("LVGLGroup", LVGLGroup);

////////////////////////////////////////////////////////////////////////////////

export class LVGLGroups extends EezObject {
    groups: LVGLGroup[];

    defaultGroupForEncoderInSimulator: string;
    defaultGroupForKeyboardInSimulator: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "groups",
                type: PropertyType.Array,
                typeClass: LVGLGroup,
                hideInPropertyGrid: true
            },
            {
                name: "defaultGroupForEncoderInSimulator",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "defaultGroupForKeyboardInSimulator",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ]
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            groups: observable,
            defaultGroupForEncoderInSimulator: observable,
            defaultGroupForKeyboardInSimulator: observable
        });
    }
}

registerClass("LVGLGroups", LVGLGroups);

////////////////////////////////////////////////////////////////////////////////

const GroupsList = observer(
    class LVGLGroupsTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <ListNavigation
                    id={"lvgl-groups"}
                    navigationObject={this.context.project.lvglGroups.groups}
                    selectedObject={
                        this.context.navigationStore.selectedLvglGroupObject
                    }
                />
            );
        }
    }
);

const WidgetNode = observer(
    class SessionNode extends React.Component<{
        widget: Widget;
    }> {
        render() {
            let label;
            const classInfo = getClassInfo(this.props.widget);
            if (classInfo.listLabel) {
                label = classInfo.listLabel(this.props.widget, true);
            } else {
                label = objectToString(this.props.widget);
            }

            return <ListItem label={label} />;
        }
    }
);

const WidgetsInGroup = observer(
    class LVGLGroupsTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get selectedGroup() {
            return this.context.navigationStore.selectedLvglGroupObject.get() as
                | LVGLGroup
                | undefined;
        }

        get selectedPage() {
            const editor = this.context.editorsStore.activeEditor;
            if (editor) {
                const object = editor.object;
                if (object instanceof ProjectEditor.PageClass) {
                    return object;
                }
            }

            return undefined;
        }

        get widgets() {
            if (this.selectedGroup && this.selectedPage) {
                const editorState =
                    this.context.editorsStore.activeEditor?.state;
                if (editorState instanceof ProjectEditor.FlowTabStateClass) {
                    const selectedObjects = editorState.selectedObjects;

                    return this.selectedPage

                        .getLvglGroupWidgets(this.selectedGroup.name)
                        .map(widgetPath => {
                            const widget = widgetPath[widgetPath.length - 1];
                            return {
                                data: widget,
                                id: widget.objID,
                                selected: selectedObjects.includes(widget)
                            };
                        });
                }
            }

            return [];
        }

        renderWidgetNode = (node: IListNode) => {
            let widget = node.data as Widget;
            return <WidgetNode widget={widget} />;
        };

        selectWidgetNode = (node: IListNode) => {
            let widget = node.data as Widget;

            const editorState = this.context.editorsStore.activeEditor?.state;
            if (editorState instanceof ProjectEditor.FlowTabStateClass) {
                editorState.selectObject(widget);
            }
        };

        render() {
            if (!this.selectedGroup || !this.selectedPage) {
                return null;
            }

            return (
                <List
                    nodes={this.widgets}
                    renderNode={this.renderWidgetNode}
                    selectNode={this.selectWidgetNode}
                />
            );
        }
    }
);

export const LVGLGroupsTab = observer(
    class LVGLGroupsTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "groups") {
                return <GroupsList />;
            }

            if (component === "order") {
                return <WidgetsInGroup />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayoutContainer
                    model={this.context.layoutModels.lvglGroups}
                    factory={this.factory}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-lvgl-groups",
    version: "0.1.0",
    description: "LVGL Groups",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "LVGL Groups",
    mandatory: true,
    key: "lvglGroups",
    type: PropertyType.Object,
    typeClass: LVGLGroups,
    icon: "material:view_compact",
    create: () => {
        return {
            groups: []
        };
    }
};

export default feature;
