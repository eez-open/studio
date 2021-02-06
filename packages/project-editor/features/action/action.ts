import { observable } from "mobx";

import { validators } from "eez-studio-shared/validation";
import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import { Message, Type } from "project-editor/core/output";
import { registerFeatureImplementation } from "project-editor/core/extensions";
import { findReferencedObject, Project, getProject } from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { ListNavigationWithProperties } from "project-editor/components/ListNavigation";
import { build } from "project-editor/features/action/build";
import { metrics } from "project-editor/features/action/metrics";

////////////////////////////////////////////////////////////////////////////////

export interface IAction {
    name: string;
    description?: string;
    implementationType: "native";
    implementation?: string;
    usedIn?: string[];
}

export class Action extends EezObject implements IAction {
    @observable name: string;
    @observable description?: string;
    @observable implementationType: "native";
    @observable implementation?: string;
    @observable usedIn?: string[];

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
                            validators: [validators.required, validators.unique({}, parent)]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        navigationComponent: ListNavigationWithProperties,
        navigationComponentId: "actions",
        icon: "code"
    };
}

registerClass(Action);

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("action", {
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
                messages.push(new Message(Type.ERROR, "Max. 32000 actions are supported", object));
            }

            return messages;
        },
        build: build,
        metrics: metrics
    }
});

////////////////////////////////////////////////////////////////////////////////

export function findAction(project: Project, actionName: string) {
    return findReferencedObject(project, "actions", actionName) as
        | Action
        | undefined;
}
