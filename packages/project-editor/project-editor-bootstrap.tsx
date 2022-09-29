import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import type { ProjectEditorTab, Tabs } from "home/tabs-store";

import { getProjectFeatures } from "project-editor/store/features";
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
import { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import { DebugInfoRuntime } from "project-editor/flow/debug-info-runtime";
import {
    build as buildProject,
    backgroundCheck,
    buildExtensions
} from "project-editor/build/build";
import { getAllMetrics } from "project-editor/project/metrics";
import {
    getProject,
    getFlow,
    Project,
    findReferencedObject,
    getNameProperty,
    checkObjectReference,
    checkAssetId
} from "project-editor/project/project";

import { extensions } from "eez-studio-shared/extensions/extensions";

import {
    ActionComponent,
    Component,
    registerActionComponent
} from "project-editor/flow/component";

import { Page } from "project-editor/features/page/page";
import { Widget } from "project-editor/flow/component";
import { Glyph } from "project-editor/features/font/font";
import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Action } from "project-editor/features/action/action";
import { ScpiCommand, ScpiSubsystem } from "project-editor/features/scpi/scpi";
import {
    getObjectVariableTypeFromType,
    registerObjectVariableType
} from "project-editor/features/variable/value-type";

import "project-editor/flow/components/actions/stream";
import "project-editor/flow/components/actions/execute-command";
import "project-editor/flow/components/actions/file";
import "project-editor/flow/components/actions/instrument";
import "project-editor/flow/components/actions/regexp";
import "project-editor/flow/components/actions/serial";
import "project-editor/flow/components/actions/http";
import "project-editor/flow/components/actions/json";
import "project-editor/flow/components/actions/python";

import "project-editor/flow/components/widgets/markdown";
import "project-editor/flow/components/widgets/plotly";
import "project-editor/flow/components/widgets/terminal";

import "project-editor/flow/components/widgets/lvgl";

import type {
    IActionComponentDefinition,
    IObjectVariableType
} from "eez-studio-types";
import { findBitmap } from "project-editor/features/bitmap/bitmap";
import {
    migrateProjectVersion,
    migrateProjectType
} from "project-editor/project/migrate-project";
import {
    getNavigationComponent,
    getNavigationObject,
    navigateTo,
    selectObject
} from "project-editor/project/NavigationComponentFactory";
import {
    createEditorState,
    getEditorComponent,
    getAncestorWithEditorComponent
} from "project-editor/project/EditorComponentFactory";
import { browseGlyph } from "project-editor/features/font/FontEditor";
import { Variable } from "project-editor/features/variable/variable";
import { CallActionActionComponent } from "project-editor/flow/components/actions";
import {
    ContainerWidget,
    LayoutViewWidget,
    ListWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";

let extensionsInitialized = false;

export async function initExtensions() {
    if (!extensionsInitialized) {
        extensionsInitialized = true;
        extensions.forEach(extension => {
            if (extension.eezFlowExtensionInit) {
                try {
                    extension.eezFlowExtensionInit({
                        registerActionComponent: (
                            actionComponentDefinition: IActionComponentDefinition
                        ) =>
                            registerActionComponent(
                                actionComponentDefinition,
                                `${extension.name}/${actionComponentDefinition.name}`
                            ),

                        registerObjectVariableType: (
                            name: string,
                            objectVariableType: IObjectVariableType
                        ) =>
                            registerObjectVariableType(
                                `${extension.name}/${name}`,
                                objectVariableType
                            ),

                        showGenericDialog,

                        validators: {
                            required: validators.required,
                            rangeInclusive: validators.rangeInclusive
                        }
                    } as any);
                } catch (err) {
                    console.error(err);
                }
            }
        });
    }
}

export async function initProjectEditor(
    homeTabs: Tabs,
    ProjectEditorTabClass: typeof ProjectEditorTab
) {
    if (ProjectEditor.DataContextClass) {
        return;
    }

    await initExtensions();

    const projectEditor: IProjectEditor = {
        homeTabs,
        ProjectEditorTabClass,
        DataContextClass: DataContext,
        extensions: getProjectFeatures(),
        documentSearch: {
            CurrentSearch,
            findAllReferences,
            isReferenced,
            findReferencedObject,
            checkObjectReference
        },
        RemoteRuntimeClass: RemoteRuntime,
        WasmRuntimeClass: WasmRuntime,
        DebugInfoRuntimeClass: DebugInfoRuntime,
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
        ConnectionLineClass: ConnectionLine,
        LayoutViewWidgetClass: LayoutViewWidget,
        SelectWidgetClass: SelectWidget,
        ContainerWidgetClass: ContainerWidget,
        ListWidgetClass: ListWidget,
        CallActionActionComponentClass: CallActionActionComponent,
        VariableClass: Variable,
        GlyphClass: Glyph,
        ScpiCommandClass: ScpiCommand,
        ScpiSubsystemClass: ScpiSubsystem,
        getProject,
        getFlow,
        getNameProperty,
        getObjectVariableTypeFromType,
        findBitmap,
        migrateProjectVersion,
        migrateProjectType,
        getNavigationComponent,
        getNavigationObject,
        navigateTo,
        selectObject,
        getEditorComponent,
        getAncestorWithEditorComponent,
        createEditorState,
        browseGlyph,
        checkAssetId
    };

    Object.assign(ProjectEditor, projectEditor);
}
