import React from "react";
import { action, computed, observable } from "mobx";
import { observer } from "mobx-react";

import { validators } from "eez-studio-shared/validation";
import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    NavigationComponent,
    EditorComponent
} from "project-editor/core/object";
import { Message, Type } from "project-editor/core/output";
import {
    findReferencedObject,
    Project,
    getProject,
    ProjectType
} from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { build } from "project-editor/features/action/build";
import { metrics } from "project-editor/features/action/metrics";
import { ProjectContext } from "project-editor/project/context";
import { Splitter } from "eez-studio-ui/splitter";
import {
    ListNavigation,
    ListNavigationWithProperties
} from "project-editor/components/ListNavigation";
import { Editors, PropertiesPanel } from "project-editor/project/ProjectEditor";
import { PageEditor as StudioPageEditor } from "project-editor/features/gui/page-editor/editor";
import { IPanel } from "project-editor/core/store";
import { Page } from "project-editor/features/gui/page";
import { PageTabState } from "project-editor/features/gui/PagesNavigation";
import { ComponentsPalette } from "project-editor/features/gui/page-editor/ComponentsPalette";
import { ThemesSideView } from "project-editor/features/gui/theme";
import { bind } from "bind-decorator";
import { TreeAdapter } from "project-editor/core/objectAdapter";
import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";
import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @bind
    focusHandler() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    @computed
    get treeAdapter() {
        let pageTabState = this.props.editor.state as PageTabState;
        return new TreeAdapter(
            pageTabState.widgetContainerDisplayItem,
            undefined,
            undefined,
            true
        );
    }

    @computed
    get selectedObject() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObject;
    }

    @computed
    get selectedObjects() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObjects;
    }

    cutSelection() {
        this.treeAdapter.cutSelection();
    }

    copySelection() {
        this.treeAdapter.copySelection();
    }

    pasteSelection() {
        this.treeAdapter.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter.deleteSelection();
    }

    render() {
        let pageTabState = this.props.editor.state as PageTabState;
        return (
            <StudioPageEditor
                widgetContainer={pageTabState.widgetContainerDisplayItem}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.NavigationStore.selectedPanel) {
            return this.context.NavigationStore.selectedPanel.selectedObject;
        }
        return this.context.NavigationStore.selectedObject;
    }

    @computed
    get widgetContainerDisplayItem() {
        if (!this.context.EditorsStore.activeEditor) {
            return undefined;
        }
        let pageTabState = this.context.EditorsStore.activeEditor
            .state as PageTabState;
        if (!pageTabState) {
            return undefined;
        }
        return pageTabState.widgetContainerDisplayItem;
    }

    @computed
    get treeAdapter() {
        if (!this.widgetContainerDisplayItem) {
            return null;
        }
        return new TreeAdapter(
            this.widgetContainerDisplayItem,
            undefined,
            undefined,
            true
        );
    }

    cutSelection() {
        this.treeAdapter!.cutSelection();
    }

    copySelection() {
        this.treeAdapter!.copySelection();
    }

    pasteSelection() {
        this.treeAdapter!.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter!.deleteSelection();
    }

    get selectedObject() {
        return this.selectedObjects[0];
    }

    get selectedObjects() {
        const selectedObjects =
            this.widgetContainerDisplayItem &&
            this.widgetContainerDisplayItem.selectedObjects;
        if (selectedObjects && selectedObjects.length > 0) {
            return selectedObjects;
        }

        if (this.context.EditorsStore.activeEditor) {
            let pageTabState = this.context.EditorsStore.activeEditor
                .state as PageTabState;
            return [pageTabState.page];
        }

        return [];
    }

    @bind
    onFocus() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    render() {
        if (!this.widgetContainerDisplayItem) {
            return <ListNavigationWithProperties {...this.props} />;
        }

        const navigation = (
            <Splitter
                type="vertical"
                persistId="page-editor/navigation-structure"
                sizes={`50%|50%`}
                childrenOverflow="hidden|hidden"
            >
                <ListNavigation
                    id={this.props.id}
                    navigationObject={this.props.navigationObject}
                />
                <Panel
                    id="page-structure"
                    title="Action Structure"
                    body={
                        this.treeAdapter ? (
                            <Tree
                                treeAdapter={this.treeAdapter}
                                tabIndex={0}
                                onFocus={this.onFocus}
                            />
                        ) : (
                            <div />
                        )
                    }
                />
            </Splitter>
        );

        const buttons: JSX.Element[] = [];

        if (!this.context.UIStateStore.viewOptions.themesVisible) {
            buttons.push(
                <IconAction
                    key="show-themes"
                    icon="material:palette"
                    iconSize={16}
                    onClick={action(
                        () =>
                            (this.context.UIStateStore.viewOptions.themesVisible = true)
                    )}
                    title="Show themes panel"
                ></IconAction>
            );
        }

        const properties = (
            <Splitter
                type="vertical"
                persistId="page-editor/properties-widgets-palette"
                sizes={`100%|200px`}
                childrenOverflow="hidden|hidden"
            >
                <PropertiesPanel
                    object={this.selectedObject}
                    buttons={buttons}
                />
                <ComponentsPalette showOnlyActions={true} />
            </Splitter>
        );

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/pages${
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? ""
                        : "-without-themes"
                }`}
                sizes={`240px|100%|400px${
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? "|240px"
                        : ""
                }`}
                childrenOverflow={`hidden|hidden|hidden${
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? "|hidden"
                        : ""
                }`}
            >
                {navigation}
                <Editors />
                {properties}
                {this.context.UIStateStore.viewOptions.themesVisible && (
                    <ThemesSideView hasCloseButton={true} />
                )}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Action extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable implementationType: "native";
    @observable implementation?: string;
    @observable usedIn?: string[];

    @observable page?: Page;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
                isAssetName: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "implementationType",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "native"
                    }
                ],
                hideInPropertyGrid: (object: IEezObject) =>
                    getProject(object).settings.general.projectVersion !== "v1"
            },
            {
                name: "implementation",
                type: PropertyType.Cpp,
                hideInPropertyGrid: (object: IEezObject) =>
                    getProject(object).settings.general.projectVersion !== "v1"
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations"
            },
            {
                name: "page",
                type: PropertyType.Object,
                typeClass: Page,
                hideInPropertyGrid: true,
                isOptional: true
            }
        ],
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Action",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name,
                    page:
                        getProject(parent).settings.general.projectType ===
                        ProjectType.DASHBOARD
                            ? {
                                  widgets: [],
                                  left: 0,
                                  top: 0,
                                  width: 0,
                                  height: 0
                              }
                            : undefined
                });
            });
        },
        createEditorState: (action: Action) => {
            return action.page ? new PageTabState(action.page) : undefined;
        },
        editorComponent: ActionEditor,
        navigationComponent: ActionsNavigation,
        navigationComponentId: "actions",
        icon: "code"
    };
}

registerClass(Action);

////////////////////////////////////////////////////////////////////////////////

export function findAction(project: Project, actionName: string) {
    return findReferencedObject(project, "actions", actionName) as
        | Action
        | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-action",
    version: "0.1.0",
    description: "Project actions",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Action",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "actions",
                type: PropertyType.Array,
                typeClass: Action,
                icon: "code",
                create: () => [],
                check: (object: IEezObject[]) => {
                    let messages: Message[] = [];

                    if (object.length > 32000) {
                        messages.push(
                            new Message(
                                Type.ERROR,
                                "Max. 32000 actions are supported",
                                object
                            )
                        );
                    }

                    return messages;
                },
                build: build,
                metrics: metrics
            }
        }
    }
};
