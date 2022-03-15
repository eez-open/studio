import {
    IEezObject,
    EezClass,
    PropertyType,
    PropertyInfo
} from "project-editor/core/object";
import type { Message } from "project-editor/core/store";

import type { Project } from "project-editor/project/project";

import type { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import actionFeature from "project-editor/features/action/action";
import dataFeature from "project-editor/features/variable/variable";
import extensionDefinitionsFeature from "project-editor/features/extension-definitions/extension-definitions";
import pageFeature from "project-editor/features/page/page";
import styleFeature from "project-editor/features/style/style";
import fontFeature from "project-editor/features/font/font";
import bitmapFeature from "project-editor/features/bitmap/bitmap";
import scpiFeature from "project-editor/features/scpi/scpi";
import shortcutsFeature from "project-editor/features/shortcuts/project-shortcuts";
import microPythonFeature from "project-editor/features/micropython/micropython";

export type BuildResult = { [key: string]: string };

export interface ExtensionImplementation {
    projectFeature: {
        mandatory: boolean;
        key: string;
        displayName?: string;
        type: PropertyType;
        typeClass: EezClass;
        icon: string | React.ReactNode;
        create: () => any;
        check?: (object: IEezObject) => Message[];
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

let extensions: Extension[] = [
    pageFeature,
    actionFeature,
    dataFeature,
    styleFeature,
    fontFeature,
    bitmapFeature,
    microPythonFeature,
    extensionDefinitionsFeature,
    scpiFeature,
    shortcutsFeature
];

export function getProjectFeatures() {
    return extensions;
}
