import { clipboard } from "electron";
import React from "react";
import { observable, makeObservable, runInAction } from "mobx";

import { validators } from "eez-studio-shared/validation";
import {
    makeDerivedClassInfo,
    registerClass,
    IEezObject,
    PropertyType,
    MessageType,
    EezObject,
    IMessage,
    PropertyProps
} from "project-editor/core/object";
import { createObject, Message } from "project-editor/store";
import {
    hasFlowSupport,
    isAppletProject,
    isDashboardProject,
    isLVGLProject,
    isNotV1Project
} from "project-editor/project/project-type-traits";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { getProjectStore } from "project-editor/store";

import { Flow } from "project-editor/flow/flow";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    generalGroup,
    specificGroup
} from "project-editor/ui-components/PropertyGrid/groups";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { CodeEditor } from "eez-studio-ui/code-editor";
import { Build, getName, NamingConvention } from "project-editor/build/helper";
import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

export const NativeActionImplementationInfoPropertyUI = observer(
    class NativeVariableImplementationInfoPropertyUI extends React.Component<PropertyProps> {
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
            return ProjectEditor.getProjectStore(this.action);
        }

        get implementationLanguage() {
            return this.projectStore.uiStateStore.implementationLanguage;
        }

        set implementationLanguage(value: string) {
            runInAction(() => {
                this.projectStore.uiStateStore.implementationLanguage = value;
            });
        }

        get hasFlowSupport() {
            return this.projectStore.projectTypeTraits.hasFlowSupport;
        }

        get action() {
            return this.props.objects[0] as Action;
        }

        get code() {
            const action = this.action;

            const actionName = getName(
                "",
                action.name,
                NamingConvention.UnderscoreLowerCase
            );

            const build = new Build();
            build.startBuild();

            build.line(`#include "actions.h"`);

            build.line("");

            build.line(
                `${
                    this.implementationLanguage == "C++" ? `extern "C" ` : ""
                }void ${"action_" + actionName}(lv_event_t *e) {`
            );
            build.indent();
            build.line(`// TODO: Implement action ${actionName} here`);
            build.unindent();
            build.line(`}`);

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
                            {this.hasFlowSupport
                                ? "For native user action "
                                : "For user action "}
                            you must provide implementation function. Below is a
                            basic implementation code for such function. You can
                            copy and paste it into some source file in your
                            project.
                        </div>
                        <div className="EezStudio_PropertyGrid_TipBox_Toolbar">
                            <select
                                className="form-select"
                                value={this.implementationLanguage}
                                onChange={event =>
                                    (this.implementationLanguage =
                                        event.target.value)
                                }
                            >
                                <option value="C">C</option>
                                <option value="C++">C++</option>
                            </select>
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

export class Action extends Flow {
    id: number | undefined;
    name: string;
    description?: string;
    implementationType: "native" | "flow";
    implementation?: string;
    usedIn?: string[];

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            id: observable,
            name: observable,
            description: observable,
            implementationType: observable,
            implementation: observable,
            usedIn: observable
        });
    }

    static classInfo = makeDerivedClassInfo(Flow.classInfo, {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup,
                disabled: isLVGLProject
            },
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
                propertyGridGroup: generalGroup
            },
            {
                name: "description",
                type: PropertyType.MultilineText,
                propertyGridGroup: generalGroup
            },
            {
                name: "implementationType",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "flow"
                    },
                    {
                        id: "native"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup,
                disabled: (action: Action) => {
                    return (
                        (isNotV1Project(action) && !hasFlowSupport(action)) ||
                        isDashboardProject(action)
                    );
                }
            },
            {
                name: "nativeImplementationInfo",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent:
                    NativeActionImplementationInfoPropertyUI,
                skipSearch: true,
                hideInPropertyGrid: (action: Action) => {
                    const projectStore = getProjectStore(action);
                    return !(
                        isLVGLProject(action) &&
                        (!projectStore.projectTypeTraits.hasFlowSupport ||
                            action.implementationType == "native")
                    );
                }
            },
            {
                name: "implementation",
                type: PropertyType.CPP,
                propertyGridGroup: specificGroup,
                disabled: isNotV1Project
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                propertyGridGroup: generalGroup,
                disabled: object =>
                    isDashboardProject(object) ||
                    isLVGLProject(object) ||
                    isAppletProject(object)
            }
        ],
        check: (action: Action, messages: IMessage[]) => {
            const projectStore = getProjectStore(action);

            ProjectEditor.checkAssetId(
                projectStore,
                "actions",
                action,
                messages
            );
        },
        label: (action: Action) => {
            const projectStore = getProjectStore(action);
            if (
                projectStore.projectTypeTraits.hasFlowSupport &&
                action.implementationType == "native"
            ) {
                return "[NATIVE] " + action.name;
            }
            return action.name;
        },
        beforeLoadHook: (action: Action, jsObject: any) => {
            if (jsObject.page) {
                jsObject.components = jsObject.page.components;
                jsObject.connectionLines = jsObject.page.connectionLines;
                delete jsObject.page;
                jsObject.implementationType = "flow";
            }
        },
        newItem: async (parent: IEezObject) => {
            const projectStore = getProjectStore(parent);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Action",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.invalidCharacters("."),
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "implementationType",
                            type: "enum",
                            enumItems: [
                                {
                                    id: "flow",
                                    label: "Flow"
                                },
                                {
                                    id: "native",
                                    label: "Native"
                                }
                            ],
                            visible: () =>
                                !projectStore.projectTypeTraits.isDashboard &&
                                projectStore.projectTypeTraits.hasFlowSupport
                        }
                    ]
                },
                values: {
                    implementationType: "flow"
                }
            });

            const actionProperties: Partial<Action> = Object.assign(
                {
                    name: result.values.name
                },
                projectStore.projectTypeTraits.hasFlowSupport
                    ? ({
                          implementationType: result.values.implementationType,
                          components: [],
                          connectionLine: []
                      } as Partial<Action>)
                    : {}
            );

            const action = createObject<Action>(
                projectStore,
                actionProperties,
                Action
            );

            return action;
        },
        icon: "material:code"
    });

    get rect() {
        return this.pageRect;
    }

    get pageRect() {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    renderWidgetComponents(flowContext: IFlowContext) {
        return null;
    }

    renderActionComponents(flowContext: IFlowContext) {
        return (
            <ComponentsContainerEnclosure
                parent={this}
                components={this.components}
                flowContext={flowContext}
            />
        );
    }
}

registerClass("Action", Action);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-action",
    version: "0.1.0",
    description: "User actions support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "User Actions",
    mandatory: true,
    key: "actions",
    type: PropertyType.Array,
    typeClass: Action,
    icon: "material:code",
    create: () => [],
    check: (projectStore, object: EezObject[], messages: IMessage[]) => {
        if (object.length > 32000) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    "Max. 32000 actions are supported",
                    object
                )
            );
        }
    }
};

export default feature;
