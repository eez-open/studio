import { observable, computed } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { registerMetaData, EezObject, EezArrayObject } from "project-editor/core/metaData";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { ScpiSubsystemsNavigation } from "project-editor/project/features/scpi/ScpiSubsystemsNavigation";
import { build } from "project-editor/project/features/scpi/build";
import { metrics } from "project-editor/project/features/scpi/metrics";

////////////////////////////////////////////////////////////////////////////////

export class ScpiCommandProperties extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable helpLink?: string;
    @observable usedIn: string[] | undefined;

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

export const scpiCommandMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ScpiCommandProperties;
    },
    className: "ScpiCommand",
    label: (object: EezObject) => (object as ScpiCommandProperties).name,
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
            name: "helpLink",
            type: "string"
        },
        {
            name: "usedIn",
            type: "configuration-references"
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
});

////////////////////////////////////////////////////////////////////////////////

export class ScpiSubsystemProperties extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable helpLink?: string;
    @observable commands: EezArrayObject<ScpiCommandProperties>;
}

export const scpiSubsystemMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ScpiSubsystemProperties;
    },
    className: "ScpiSubsystem",
    label: (object: EezObject) => (object as ScpiSubsystemProperties).name,
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
            name: "helpLink",
            type: "string"
        },
        {
            name: "commands",
            type: "array",
            typeMetaData: scpiCommandMetaData,
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
});

////////////////////////////////////////////////////////////////////////////////

export class ScpiProperties extends EezObject {
    @observable subsystems: EezArrayObject<ScpiSubsystemProperties>;
}

export const scpiMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ScpiProperties;
    },
    className: "Scpi",
    label: () => "SCPI",
    properties: () => [
        {
            name: "subsystems",
            type: "array",
            typeMetaData: scpiSubsystemMetaData,
            hideInPropertyGrid: true
        }
    ],
    navigationComponent: ScpiSubsystemsNavigation,
    navigationComponentId: "scpi",
    defaultNavigationKey: "subsystems",
    icon: "navigate_next"
});

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("scpi", {
    projectFeature: {
        mandatory: false,
        key: "scpi",
        type: "object",
        metaData: scpiMetaData,
        create: () => {
            return {
                subsystems: []
            };
        },
        build: build,
        metrics: metrics
    }
});
