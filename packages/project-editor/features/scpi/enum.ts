import { observable, makeObservable } from "mobx";

import { stringCompare } from "eez-studio-shared/string";

import { validators } from "eez-studio-shared/validation";

//import { isReferenced } from "project-editor/core/search";

import { showGenericDialog, EnumItems } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    IEezObject,
    EezObject,
    PropertyType,
    getParent,
    MessageType,
    IMessage
} from "project-editor/core/object";
import {
    createObject,
    getChildOfObject,
    getLabel,
    Message,
    propertyNotSetMessage
} from "project-editor/store";
import { ProjectStore } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export class ScpiEnumMember extends EezObject {
    name: string;
    value: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String
            },
            {
                name: "value",
                type: PropertyType.String
            }
        ],

        defaultValue: {},

        check: (object: ScpiEnumMember, messages: IMessage[]) => {
            if (object.name) {
                const arr = getParent(object) as ScpiEnumMember[];
                let thisIndex = -1;
                let otherIndex = -1;
                for (let i = 0; i < arr.length; ++i) {
                    if (arr[i] === object) {
                        thisIndex = i;
                    } else if (
                        arr[i] !== object &&
                        arr[i].name === object.name
                    ) {
                        otherIndex = i;
                    }
                }
                if (otherIndex !== -1 && thisIndex > otherIndex) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Member name '${object.name}' is not unique`,
                            getChildOfObject(object, "name")
                        )
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(object, "name"));
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            value: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiEnum extends EezObject {
    name: string;
    members: ScpiEnumMember[];

    static classInfo: ClassInfo = {
        label: (scpiEnum: ScpiEnum) => {
            return `${scpiEnum.name} (${scpiEnum.members
                .map(member => member.name)
                .join(" | ")})`;
        },
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "members",
                type: PropertyType.Array,
                typeClass: ScpiEnumMember
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Enumeration",
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
            });

            const scpiEnumProperties: Partial<ScpiEnum> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const scpiEnum = createObject<ScpiEnum>(
                project._store,
                scpiEnumProperties,
                ScpiEnum
            );

            return scpiEnum;
        },
        check: (object: ScpiEnum, messages: IMessage[]) => {
            // TODO this check is removed because it is too slow
            // if (!isReferenced(this)) {
            //     messages.push(
            //         new output.Message(output.Type.WARNING, "enum not used in the project", this)
            //     );
            // }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            members: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export function findScpiEnum(projectStore: ProjectStore, enumeration: string) {
    const scpi = projectStore.project.scpi;

    for (let i = 0; i < scpi.enums.length; ++i) {
        if (scpi.enums[i].name === enumeration) {
            return scpi.enums[i];
        }
    }

    return undefined;
}

export function getScpiEnumsAsDialogEnumItems(
    projectStore: ProjectStore
): EnumItems {
    return projectStore.project.scpi.enums
        .slice()
        .sort((a, b) => stringCompare(getLabel(a), getLabel(b)))
        .map(scpiEnum => ({
            id: scpiEnum.name,
            label: getLabel(scpiEnum)
        }));
}
