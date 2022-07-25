import React from "react";
import { observable, makeObservable } from "mobx";

import { validators } from "eez-studio-shared/validation";
import {
    makeDerivedClassInfo,
    registerClass,
    IEezObject,
    PropertyType,
    MessageType
} from "project-editor/core/object";
import {
    isDashboardOrApplet,
    isNotFirmwareWithFlowSupportProject,
    isNotV1Project,
    Message
} from "project-editor/store";
import type { Project } from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { metrics } from "project-editor/features/action/metrics";
import { getDocumentStore } from "project-editor/store";

import { Flow } from "project-editor/flow/flow";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";

////////////////////////////////////////////////////////////////////////////////

export class Action extends Flow {
    id: number | undefined;
    name: string;
    description?: string;
    implementationType: "native" | "flow";
    implementation?: string;
    usedIn?: string[];

    constructor() {
        super();

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
                propertyGridGroup: generalGroup
            },
            {
                name: "name",
                type: PropertyType.String,
                unique: true
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
                    },
                    {
                        id: "flow"
                    }
                ],
                hideInPropertyGrid: (action: Action) =>
                    isNotV1Project(action) &&
                    isNotFirmwareWithFlowSupportProject(action)
            },
            {
                name: "implementation",
                type: PropertyType.CPP,
                hideInPropertyGrid: isNotV1Project
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                hideInPropertyGrid: isDashboardOrApplet
            }
        ],
        check: (action: Action) => {
            let messages: Message[] = [];

            const projectEditorStore = getDocumentStore(action);

            ProjectEditor.checkAssetId(
                projectEditorStore,
                "actions",
                action,
                messages
            );

            return messages;
        },
        label: (action: Action) => {
            if (action.implementationType == "native") {
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
                const projectEditorStore = getDocumentStore(parent);
                return Promise.resolve(
                    Object.assign(
                        {
                            name: result.values.name
                        },
                        projectEditorStore.project.isDashboardProject ||
                            projectEditorStore.project.isAppletProject ||
                            projectEditorStore.project
                                .isFirmwareWithFlowSupportProject
                            ? ({
                                  implementationType: "flow",
                                  components: [],
                                  connectionLine: []
                              } as Partial<Action>)
                            : {}
                    )
                );
            });
        },
        icon: "code"
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

export function findAction(project: Project, actionName: string) {
    return ProjectEditor.documentSearch.findReferencedObject(
        project,
        "actions",
        actionName
    ) as Action | undefined;
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
                                MessageType.ERROR,
                                "Max. 32000 actions are supported",
                                object
                            )
                        );
                    }

                    return messages;
                },
                metrics: metrics
            }
        }
    }
};
