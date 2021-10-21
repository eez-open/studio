import React from "react";
import * as mobx from "mobx";

import { validators } from "eez-studio-shared/validation";

import { theme } from "eez-studio-ui/theme";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import "project-editor/project/builtInFeatures";

import { getProjectFeatures } from "project-editor/core/extensions";
import {
    CurrentSearch,
    findAllReferences,
    isReferenced
} from "project-editor/core/search";
import { DataContext } from "project-editor/features/variable/variable";

import {
    ProjectEditor,
    IProjectEditor
} from "project-editor/project-editor-interface";
import { RemoteRuntime } from "project-editor/flow/remote-runtime";
import { LocalRuntime } from "project-editor/flow/local-runtime";
import {
    build as buildProject,
    backgroundCheck,
    buildExtensions
} from "project-editor/project/build";
import { getAllMetrics } from "project-editor/project/metrics";
import {
    getProject,
    getFlow,
    Project,
    findReferencedObject,
    getNameProperty,
    checkObjectReference
} from "project-editor/project/project";

import { extensions } from "eez-studio-shared/extensions/extensions";

import {
    ActionComponent,
    Component,
    makeExpressionProperty
} from "project-editor/flow/component";

import { RenderVariableStatus } from "project-editor/features/variable/variable";
import { ObjectType } from "project-editor/features/variable/value-type";
import {
    EezClass,
    makeDerivedClassInfo,
    registerClass,
    specificGroup
} from "project-editor/core/object";
import { Page } from "project-editor/features/page/page";
import { Widget } from "project-editor/flow/component";
import { Glyph } from "project-editor/features/font/font";
import { EmbeddedWidget } from "project-editor/flow/components/widgets";
import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Action } from "project-editor/features/action/action";
import { ScpiCommand, ScpiSubsystem } from "project-editor/features/scpi/scpi";

import "project-editor/flow/components/instrument";

let extensionsInitialized = false;

export async function initExtensions() {
    if (!extensionsInitialized) {
        extensionsInitialized = true;
        if (EEZStudio.electron) {
            extensions.forEach(extension => {
                if (extension.eezFlowExtensionInit) {
                    try {
                        extension.eezFlowExtensionInit({
                            React,
                            mobx,
                            theme: theme(),
                            registerClass(aClass: EezClass) {
                                registerClass(
                                    `${extension.name}/${aClass.name}`,
                                    aClass
                                );
                            },
                            makeDerivedClassInfo,
                            makeExpressionProperty,
                            ActionComponent,
                            ObjectType,
                            getFlow,
                            showGenericDialog,
                            validators: {
                                required: validators.required,
                                rangeInclusive: validators.rangeInclusive
                            },
                            propertyGridGroups: {
                                specificGroup
                            },
                            RenderVariableStatus
                        } as any);
                    } catch (err) {
                        console.error(err);
                    }
                }
            });
        }
    }
}

export async function initProjectEditor() {
    if (ProjectEditor.DataContextClass) {
        return;
    }

    await initExtensions();

    const projectEditor: IProjectEditor = {
        DataContextClass: DataContext,
        extensions: getProjectFeatures(),
        documentSearch: {
            CurrentSearch,
            findAllReferences,
            isReferenced,
            findReferencedObject,
            checkObjectReference
        },
        LocalRuntimeClass: LocalRuntime,
        RemoteRuntimeClass: RemoteRuntime,
        build: {
            buildProject,
            backgroundCheck,
            buildExtensions
        },
        getAllMetrics,
        ProjectClass: Project,
        FlowClass: Flow,
        PageClass: Page,
        ActionClass: Action,
        ComponentClass: Component,
        ActionComponentClass: ActionComponent,
        WidgetClass: Widget,
        EmbeddedWidgetClass: EmbeddedWidget,
        ConnectionLineClass: ConnectionLine,
        GlyphClass: Glyph,
        ScpiCommandClass: ScpiCommand,
        ScpiSubsystemClass: ScpiSubsystem,
        getProject,
        getFlow,
        getNameProperty
    };

    Object.assign(ProjectEditor, projectEditor);
}
