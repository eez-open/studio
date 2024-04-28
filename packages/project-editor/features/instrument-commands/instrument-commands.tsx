import { observable, makeObservable } from "mobx";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import { createObject } from "project-editor/store";

import { ProjectEditor } from "project-editor/project-editor-interface";
import type { ProjectEditorFeature } from "project-editor/store/features";

////////////////////////////////////////////////////////////////////////////////

export class InstrumentCommand extends EezObject {
    command: string;
    description?: string;
    helpLink?: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "command",
                type: PropertyType.String
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "helpLink",
                type: PropertyType.String
            }
        ],
        label: (object: InstrumentCommand) => object.command,
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Instrument Command",
                    fields: [
                        {
                            name: "command",
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

            const scpiSubsystemProperties: Partial<InstrumentCommand> = {
                command: result.values.command
            };

            const project = ProjectEditor.getProject(parent);

            const instrumentCommand = createObject<InstrumentCommand>(
                project._store,
                scpiSubsystemProperties,
                InstrumentCommand
            );

            return instrumentCommand;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            description: observable,
            helpLink: observable,
            command: observable
        });
    }
}

registerClass("InstrumentCommand", InstrumentCommand);

////////////////////////////////////////////////////////////////////////////////

export class InstrumentCommands extends EezObject {
    commands: InstrumentCommand[];

    static classInfo: ClassInfo = {
        label: () => "Instrument Commands",
        properties: [
            {
                name: "commands",
                type: PropertyType.Array,
                typeClass: InstrumentCommand,
                hideInPropertyGrid: true
            }
        ],
        icon: "material:navigate_next"
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            commands: observable
        });
    }
}

registerClass("InstrumentCommands", InstrumentCommands);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-instrument-commands",
    version: "0.1.0",
    description: "This feature adds support for instrument commands definition",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Instrument Commands",
    mandatory: false,
    key: "instrumentCommands",
    type: PropertyType.Object,
    typeClass: InstrumentCommands,
    icon: "material:navigate_next",
    create: () => {
        return {
            commands: []
        };
    }
};

export default feature;
