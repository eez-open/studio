import React from "react";
import { observable } from "mobx";

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
} from "project-editor/core/store";
import type { Project } from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { build } from "project-editor/features/action/build";
import { metrics } from "project-editor/features/action/metrics";
import { getDocumentStore } from "project-editor/core/store";

import { Flow } from "project-editor/flow/flow";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export class Action extends Flow {
    @observable name: string;
    @observable description?: string;
    @observable implementationType: "native" | "flow";
    @observable implementation?: string;
    @observable usedIn?: string[];

    static classInfo = makeDerivedClassInfo(Flow.classInfo, {
        properties: [
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
                const DocumentStore = getDocumentStore(parent);
                return Promise.resolve(
                    Object.assign(
                        {
                            name: result.values.name
                        },
                        DocumentStore.project.isDashboardProject ||
                            DocumentStore.project.isAppletProject ||
                            DocumentStore.project
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

    get pageRect() {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    renderComponents(flowContext: IFlowContext) {
        return (
            <ComponentsContainerEnclosure
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
                build: build,
                metrics: metrics
            }
        }
    }
};
