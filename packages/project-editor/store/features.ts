import {
    IEezObject,
    EezClass,
    PropertyType,
    PropertyInfo,
    IMessage
} from "project-editor/core/object";

import type { Project } from "project-editor/project/project";
import type { ProjectStore } from "project-editor/store";

import type { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import actionFeature from "project-editor/features/action/action";
import variableFeature from "project-editor/features/variable/variable";
import extensionDefinitionsFeature from "project-editor/features/extension-definitions/extension-definitions";
import userPageFeature from "project-editor/features/page/page";
import userWidgetFeature from "project-editor/features/user-widget/user-widget";
import styleFeature from "project-editor/features/style/style";
import fontFeature from "project-editor/features/font/font";
import bitmapFeature from "project-editor/features/bitmap/bitmap";
import scpiFeature from "project-editor/features/scpi/scpi";
import instrumentCommandsFeature from "project-editor/features/instrument-commands/instrument-commands";
import shortcutsFeature from "project-editor/features/shortcuts/project-shortcuts";
import microPythonFeature from "project-editor/features/micropython/micropython";
import textsFeature from "project-editor/features/texts";
import readmeFeature from "project-editor/features/readme";
import diffFeature from "project-editor/features/changes";
import jsonStylesFeature from "project-editor/lvgl/style";
import lvglGroupsFeature from "project-editor/lvgl/groups";

export type BuildResult = { [key: string]: string };

export interface ProjectEditorFeature {
    name: string;
    displayName: string;
    version: string;
    description: string;
    author: string;
    authorLogo: string;
    mandatory: boolean;
    key: string;
    type: PropertyType;
    typeClass: EezClass;
    icon: string | React.ReactNode;
    create: () => any;
    check?: (
        projectStore: ProjectStore,
        object: IEezObject,
        messages: IMessage[]
    ) => void;
    collectExtensionDefinitions?: (
        project: Project,
        extensionDefinition: ExtensionDefinition,
        properties: any
    ) => void;
    toJsHook?: (jsObject: any, object: IEezObject) => void;
    afterLoadProject?: (project: Project) => void;
    enumerable?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
}

let features: ProjectEditorFeature[] = [
    userPageFeature,
    userWidgetFeature,
    actionFeature,
    variableFeature,
    styleFeature,
    jsonStylesFeature,
    fontFeature,
    bitmapFeature,
    textsFeature,
    extensionDefinitionsFeature,
    scpiFeature,
    instrumentCommandsFeature,
    shortcutsFeature,
    microPythonFeature,
    diffFeature,
    readmeFeature,
    lvglGroupsFeature
];

export function getProjectFeatures() {
    return features;
}
