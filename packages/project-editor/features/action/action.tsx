import React from "react";
import { observable, makeObservable } from "mobx";

import { validators } from "eez-studio-shared/validation";
import {
    makeDerivedClassInfo,
    registerClass,
    IEezObject,
    PropertyType,
    MessageType,
    EezObject,
    IMessage
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
                        id: "native"
                    },
                    {
                        id: "flow"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup,
                disabled: (action: Action) => {
                    return isNotV1Project(action) && !hasFlowSupport(action);
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
        newItem: async (parent: IEezObject) => {
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
                        }
                    ]
                },
                values: {}
            });

            const projectStore = getProjectStore(parent);

            const actionProperties: Partial<Action> = Object.assign(
                {
                    name: result.values.name
                },
                projectStore.projectTypeTraits.hasFlowSupport
                    ? ({
                          implementationType: "flow",
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
