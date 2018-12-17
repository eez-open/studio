import { observable } from "mobx";

import { humanize } from "eez-studio-shared/string";

import { validators } from "eez-studio-shared/model/validation";
import * as output from "eez-studio-shared/model/output";

import { showGenericDialog, EnumItems } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    EezObject,
    EezArrayObject,
    PropertyType,
    asArray,
    getChildOfObject
} from "eez-studio-shared/model/object";

import { ProjectStore } from "project-editor/core/store";

import { Scpi } from "project-editor/project/features/scpi/scpi";

import { ScpiEnumsNavigation } from "project-editor/project/features/scpi/ScpiEnumsNavigation";

////////////////////////////////////////////////////////////////////////////////

export class ScpiEnumMember extends EezObject {
    @observable
    name: string;

    @observable
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

        defaultValue: {}
    };

    check(object: EezObject) {
        const messages: output.Message[] = [];

        if (this.name) {
            const arr = asArray<ScpiEnumMember>(this._parent!);
            let thisIndex = -1;
            let otherIndex = -1;
            for (let i = 0; i < arr.length; ++i) {
                if (arr[i] === this) {
                    thisIndex = i;
                } else if (arr[i] !== this && arr[i].name === this.name) {
                    otherIndex = i;
                }
            }
            if (otherIndex !== -1 && thisIndex > otherIndex) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        `Member name '${this.name}' is not unique`,
                        getChildOfObject(this, "name")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "name"));
        }

        if (this.value) {
            const arr = asArray<ScpiEnumMember>(this._parent!);
            let thisIndex = -1;
            let otherIndex = -1;
            for (let i = 0; i < arr.length; ++i) {
                if (arr[i] === this) {
                    thisIndex = i;
                } else if (arr[i] !== this && arr[i].value === this.value) {
                    otherIndex = i;
                }
            }
            if (otherIndex !== -1 && thisIndex > otherIndex) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        `Value '${this.value}' is not unique`,
                        getChildOfObject(this, "value")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "value"));
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiEnum extends EezObject {
    @observable
    name: string;

    @observable
    members: EezArrayObject<ScpiEnumMember>;

    static classInfo: ClassInfo = {
        label: (scpiEnum: ScpiEnum) => {
            return `${scpiEnum.name} (${scpiEnum.members._array
                .map(member => member.name)
                .join("|")})`;
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
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Enumaration",
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
                    name: result.values.name
                });
            });
        },
        navigationComponent: ScpiEnumsNavigation,
        navigationComponentId: "scpi-enums",
        icon: "format_list_numbered"
    };
}

////////////////////////////////////////////////////////////////////////////////

export function findScpiEnum(enumeration: string) {
    const scpi = (ProjectStore.project as any).scpi as Scpi;

    for (let i = 0; i < scpi.enums._array.length; ++i) {
        if (scpi.enums._array[i].name === enumeration) {
            return scpi.enums._array[i];
        }
    }

    return undefined;
}

export function getScpiEnumsAsDialogEnumItems(): EnumItems {
    const scpi = (ProjectStore.project as any).scpi as Scpi;

    return scpi.enums._array.map(scpiEnum => ({
        id: scpiEnum.name,
        label: humanize(scpiEnum.name)
    }));
}
