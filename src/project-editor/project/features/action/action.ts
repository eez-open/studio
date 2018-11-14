import { observable, computed } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { registerMetaData, EezObject } from "project-editor/core/metaData";
import { ProjectStore, asArray } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";
import { Message, Type } from "project-editor/core/output";

import { showGenericDialog } from "eez-studio-shared/ui/generic-dialog";

import { ListNavigationWithContent } from "project-editor/project/ListNavigation";

import { ActionEditor } from "project-editor/project/features/action/ActionEditor";

import { build } from "project-editor/project/features/action/build";
import { metrics } from "project-editor/project/features/action/metrics";

////////////////////////////////////////////////////////////////////////////////

export class ActionProperties extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    implementationType: "graphical" | "native";
    @observable
    implementation?: string;
    @observable
    usedIn: string[] | undefined;

    @computed
    get implementationCode() {
        let implementationCode: string | undefined;

        if (this.implementationType == "graphical") {
            // TODO convert graphical implementation to native
        } else {
            if (this.implementation) {
                // remove empty lines
                let lines = this.implementation.split("\n").filter(line => line.trim() != "");
                implementationCode = lines.join("\n");
                if (implementationCode.length == 0) {
                    implementationCode = undefined;
                }
            }
        }

        return implementationCode;
    }

    check() {
        let messages: Message[] = [];

        if (!this.implementationCode) {
            messages.push(new Message(Type.WARNING, "Action is not implemented.", this));
        }

        return messages;
    }
}

export const actionMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ActionProperties;
    },
    className: "Action",
    label: (action: ActionProperties) => {
        return action.name;
    },
    properties: () => [
        {
            name: "name",
            type: "string",
            unique: true
        },
        {
            name: "description",
            type: "multiline-text"
        },
        {
            name: "implementationType",
            type: "enum",
            enumItems: [
                {
                    id: "graphical"
                },
                {
                    id: "native"
                }
            ]
        },
        {
            name: "implementation",
            type: "string",
            hideInPropertyGrid: true
        },
        {
            name: "usedIn",
            type: "configuration-references"
        }
    ],
    newItem: (parent: EezObject) => {
        return showGenericDialog({
            dialogDefinition: {
                title: "New Action",
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [validators.required, validators.unique({}, parent)]
                    }
                ]
            },
            values: {}
        }).then(result => {
            return Promise.resolve({
                name: result.values.name,
                implementationType: "native"
            });
        });
    },
    editorComponent: ActionEditor,
    navigationComponent: ListNavigationWithContent,
    navigationComponentId: "actions",
    icon: "code"
});

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("action", {
    projectFeature: {
        mandatory: false,
        key: "actions",
        type: "array",
        metaData: actionMetaData,
        create: () => [],
        check: (object: EezObject) => {
            let messages: Message[] = [];

            if (asArray(object).length >= 65535) {
                messages.push(new Message(Type.ERROR, "Max. 65534 actions are supported", object));
            }

            return messages;
        },
        build: build,
        metrics: metrics
    }
});

////////////////////////////////////////////////////////////////////////////////

function getActions() {
    return (ProjectStore.projectProperties as any).actions;
}

export function findAction(actionName: string) {
    let actions = getActions();
    for (let i = 0; i < actions.length; i++) {
        let action = actions[i];
        if (action.name == actionName) {
            return action;
        }
    }
}

export function findActionIndex(actionName: string) {
    let actions = getActions();
    for (let i = 0; i < actions.length; i++) {
        if (actions[i].name == actionName) {
            return i;
        }
    }
    return -1;
}
