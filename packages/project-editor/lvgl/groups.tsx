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
import { CodeEditor } from "eez-studio-ui/code-editor";
import { Build, getName, NamingConvention } from "project-editor/build/helper";
import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";
import { clipboard } from "electron";

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

export const GroupImplementationInfoPropertyUI = observer(
    class GroupImplementationInfoPropertyUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        codeEditorRef = React.createRef<CodeEditor>();

        componentDidMount() {
            this.codeEditorRef.current?.resize();
        }

        componentDidUpdate() {
            this.codeEditorRef.current?.resize();
        }

        get projectStore() {
            return ProjectEditor.getProjectStore(this.group);
        }

        get implementationLanguage() {
            return this.projectStore.uiStateStore.implementationLanguage;
        }

        get hasFlowSupport() {
            return this.projectStore.projectTypeTraits.hasFlowSupport;
        }

        get group() {
            return this.props.objects[0] as LVGLGroup;
        }

        get code() {
            const group = this.group;

            const groupName = getName(
                "",
                group.name,
                NamingConvention.UnderscoreLowerCase
            );

            const build = new Build();
            build.startBuild();

            build.line(`#include "ui.h"`);
            build.line(
                `#include "screens.h" // pick group declarations from here`
            );

            build.line("");

            build.line(`// you should initialize your input device`);
            build.line(`// before calling "ui_create_groups()"`);
            build.line("lv_indev_t *my_indev;");
            build.line("// ...");

            build.line("");

            build.line(`// call this before "ui_init()"`);
            build.line(`ui_create_groups();`);

            build.line("");

            build.line("// set group for your input device");
            build.line(`lv_indev_set_group(my_indev, groups.${groupName});`);

            build.line("");
            build.line("// ...");
            build.line("");

            build.line(`ui_init();`);

            build.line("");

            build.line("// ...");

            return build.result;
        }

        render() {
            const code = this.code;

            return (
                <div className="EezStudio_PropertyGrid_TipBox">
                    <div className="EezStudio_PropertyGrid_TipBox_Description">
                        <div className="EezStudio_PropertyGrid_TipBox_Header">
                            <Icon icon="material:lightbulb_outline" />
                            <span>TIP</span>
                        </div>
                        <div className="EezStudio_PropertyGrid_TipBox_DescriptionText">
                            From your code you neeed to set a destination group
                            for a particular input device using
                            <i> lv_indev_set_group</i>. Below is an example code
                            that does that.
                        </div>
                        <div className="EezStudio_PropertyGrid_TipBox_Toolbar">
                            <div />
                            <IconAction
                                icon="material:content_copy"
                                iconSize={20}
                                title="Copy to Clipboard"
                                onClick={() => {
                                    clipboard.writeText(code);
                                }}
                            />
                        </div>
                    </div>
                    <CodeEditor
                        ref={this.codeEditorRef}
                        mode="c_cpp"
                        value={code}
                        onChange={() => {}}
                        readOnly={true}
                        className="form-control"
                        minLines={2}
                        maxLines={50}
                    />
                </div>
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
            },
            {
                name: "groupImplementationInfo",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: GroupImplementationInfoPropertyUI,
                skipSearch: true
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
