import { IEezObject, EezClass, PropertyType } from "project-editor/core/object";
import { Message } from "project-editor/core/output";
import { Project, BuildConfiguration } from "project-editor/project/project";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import actionFeature from "project-editor/features/action/action";
import dataFeature from "project-editor/features/data/data";
import extensionDefinitionsFeature from "project-editor/features/extension-definitions/extension-definitions";
import guiFeature from "project-editor/features/gui/gui";
import scpiFeature from "project-editor/features/scpi/scpi";
import shortcutsFeature from "project-editor/features/shortcuts/shortcuts";

export type BuildResult = { [key: string]: string };

export interface ExtensionImplementation {
    projectFeature: {
        mandatory: boolean;
        key: string;
        displayName?: string;
        type: PropertyType;
        typeClass: EezClass;
        icon: string;
        create: () => any;
        check?: (object: IEezObject) => Message[];
        build?: (
            project: Project,
            sectionNames: string[] | undefined,
            buildConfiguration: BuildConfiguration | undefined
        ) => Promise<BuildResult>;
        collectExtensionDefinitions?: (
            project: Project,
            extensionDefinition: ExtensionDefinition,
            properties: any
        ) => void;
        metrics?: (project: Project) => { [key: string]: string | number };
        toJsHook?: (jsObject: any, object: IEezObject) => void;
    };
}

export interface Extension {
    name: string;
    version: string;
    description: string;
    author: string;
    authorLogo: string;
    eezStudioExtension: {
        displayName: string;
        implementation: ExtensionImplementation;
    };
}

////////////////////////////////////////////////////////////////////////////////

let extensions: Extension[] = [];

////////////////////////////////////////////////////////////////////////////////

export function loadExtensions(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        function sortExtensions() {
            // sort project-feature extensions such that mandatory extensions are before optional extensions
            extensions.sort((a, b) => {
                var aMandatory =
                    a.eezStudioExtension.implementation.projectFeature
                        .mandatory;
                var bMandatory =
                    b.eezStudioExtension.implementation.projectFeature
                        .mandatory;
                if (aMandatory && !bMandatory) {
                    return -1;
                } else if (!aMandatory && bMandatory) {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });
        }

        function addExtension(extension: Extension) {
            extensions.push(extension);
        }

        addExtension(actionFeature);
        addExtension(dataFeature);
        addExtension(extensionDefinitionsFeature);
        addExtension(guiFeature);
        addExtension(scpiFeature);
        addExtension(shortcutsFeature);

        sortExtensions();

        resolve();
    });
}

export function getProjectFeatures() {
    return extensions;
}
