import { observable, computed } from "mobx";

import { validators } from "eez-studio-shared/validation";
import {
    ClassInfo,
    registerClass,
    EezObject,
    PropertyType,
    asArray
} from "project-editor/core/object";
import { Message, Type } from "project-editor/core/output";

import { ProjectStore } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { ListNavigationWithContent } from "project-editor/components/ListNavigation";

import { ActionEditor } from "project-editor/features/action/ActionEditor";

import { build } from "project-editor/features/action/build";
import { metrics } from "project-editor/features/action/metrics";

////////////////////////////////////////////////////////////////////////////////

export class Action extends EezObject {
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

    static classInfo: ClassInfo = {
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
                        id: "graphical"
                    },
                    {
                        id: "native"
                    }
                ]
            },
            {
                name: "implementation",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference
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
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
                            ]
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
    };

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
}

registerClass(Action);

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("action", {
    projectFeature: {
        mandatory: false,
        key: "actions",
        type: PropertyType.Array,
        typeClass: Action,
        create: () => [],
        check: (object: EezObject) => {
            let messages: Message[] = [];

            if (asArray(object).length >= 65535) {
                messages.push(new Message(Type.ERROR, "Max. 65535 actions are supported", object));
            }

            return messages;
        },
        build: build,
        metrics: metrics
    }
});

////////////////////////////////////////////////////////////////////////////////

export function findAction(actionName: string) {
    return ProjectStore.project.actionsMap.get(actionName);
}
