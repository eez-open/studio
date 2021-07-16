import {
    IEezObject,
    EezClass,
    PropertyType,
    PropertyInfo
} from "project-editor/core/object";
import { Message } from "project-editor/core/output";
import { Project, BuildConfiguration } from "project-editor/project/project";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import actionFeature from "project-editor/features/action/action";
import dataFeature from "project-editor/features/variable/variable";
import extensionDefinitionsFeature from "project-editor/features/extension-definitions/extension-definitions";
import pageFeature from "project-editor/features/page/page";
import styleFeature from "project-editor/features/style/style";
import fontFeature from "project-editor/features/font/font";
import bitmapFeature from "project-editor/features/bitmap/bitmap";
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
        enumerable?:
            | boolean
            | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
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

export function loadExtensions() {
    extensions.push(pageFeature);
    extensions.push(actionFeature);
    extensions.push(dataFeature);
    extensions.push(styleFeature);
    extensions.push(fontFeature);
    extensions.push(bitmapFeature);
    extensions.push(extensionDefinitionsFeature);
    extensions.push(scpiFeature);
    extensions.push(shortcutsFeature);
}

export function getProjectFeatures() {
    return extensions;
}
