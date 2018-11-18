import { observable, computed } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    registerClass,
    EezObject,
    EezArrayObject,
    PropertyType
} from "project-editor/core/metaData";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { ScpiSubsystemsNavigation } from "project-editor/project/features/scpi/ScpiSubsystemsNavigation";
import { build } from "project-editor/project/features/scpi/build";
import { metrics } from "project-editor/project/features/scpi/metrics";

////////////////////////////////////////////////////////////////////////////////

export class ScpiCommand extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable helpLink?: string;
    @observable usedIn: string[] | undefined;

    static classInfo = {
        getClass: function(jsObject: any) {
            return ScpiCommand;
        },
        className: "ScpiCommand",
        label: (object: EezObject) => (object as ScpiCommand).name,
        properties: () => [
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
                name: "helpLink",
                type: PropertyType.String
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Command",
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
        }
    };

    @computed
    get shortCommand(): string {
        return this.name
            .replace(/[a-z]/g, "") // remove lower case letters
            .replace(/\[.*\]/g, ""); // remove optional parts (between [])
    }

    @computed
    get longCommand(): string {
        return this.name.replace(/[\[\]]/g, ""); // remove [ and ]
    }
}

registerClass(ScpiCommand);

////////////////////////////////////////////////////////////////////////////////

export class ScpiSubsystem extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable helpLink?: string;
    @observable commands: EezArrayObject<ScpiCommand>;

    static classInfo = {
        getClass: function(jsObject: any) {
            return ScpiSubsystem;
        },
        className: "ScpiSubsystem",
        label: (object: EezObject) => (object as ScpiSubsystem).name,
        properties: () => [
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
                name: "helpLink",
                type: PropertyType.String
            },
            {
                name: "commands",
                type: PropertyType.Array,
                typeClassInfo: ScpiCommand.classInfo,
                hideInPropertyGrid: true
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Subsystem",
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
                    commands: []
                });
            });
        },
        navigationComponent: ScpiSubsystemsNavigation,
        navigationComponentId: "scpi-subsystems",
        icon: "list"
    };
}

registerClass(ScpiSubsystem);

////////////////////////////////////////////////////////////////////////////////

export class Scpi extends EezObject {
    @observable subsystems: EezArrayObject<ScpiSubsystem>;

    static classInfo = {
        getClass: function(jsObject: any) {
            return Scpi;
        },
        className: "Scpi",
        label: () => "SCPI",
        properties: () => [
            {
                name: "subsystems",
                type: PropertyType.Array,
                typeClassInfo: ScpiSubsystem.classInfo,
                hideInPropertyGrid: true
            }
        ],
        navigationComponent: ScpiSubsystemsNavigation,
        navigationComponentId: "scpi",
        defaultNavigationKey: "subsystems",
        icon: "navigate_next"
    };
}

registerClass(Scpi);

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("scpi", {
    projectFeature: {
        mandatory: false,
        key: "scpi",
        type: PropertyType.Object,
        classInfo: Scpi.classInfo,
        create: () => {
            return {
                subsystems: []
            };
        },
        build: build,
        metrics: metrics
    }
});
