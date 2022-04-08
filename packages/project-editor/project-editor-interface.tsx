import type { ProjectEditorTab, Tabs } from "home/tabs-store";
import type { Extension } from "project-editor/core/extensions";
import type { IDocumentSearch } from "project-editor/core/search";
import type { DataContext } from "project-editor/features/variable/variable";
import type { RemoteRuntime } from "project-editor/flow/remote-runtime";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import type { DebugInfoRuntime } from "project-editor/flow/debug-info-runtime";
import type {
    build,
    backgroundCheck,
    buildExtensions
} from "project-editor/build/build";
import type { getAllMetrics } from "project-editor/project/metrics";
import type {
    checkAssetId,
    getFlow,
    getNameProperty,
    getProject,
    Project
} from "project-editor/project/project";
import type { Page } from "project-editor/features/page/page";
import type {
    ActionComponent,
    Component,
    Widget
} from "project-editor/flow/component";
import type { Glyph } from "project-editor/features/font/font";
import type { ConnectionLine, Flow } from "project-editor/flow/flow";
import type { Action } from "project-editor/features/action/action";
import type {
    ScpiCommand,
    ScpiSubsystem
} from "project-editor/features/scpi/scpi";
import type { getObjectVariableTypeFromType } from "project-editor/features/variable/value-type";
import type { findBitmap } from "project-editor/features/bitmap/bitmap";
import type {
    migrateProjectVersion,
    migrateProjectType
} from "project-editor/project/migrate-project";
import type {
    getNavigationComponent,
    getNavigationObject,
    navigateTo,
    selectObject
} from "project-editor/project/NavigationComponentFactory";
import type {
    createEditorState,
    getEditorComponent,
    getAncestorWithEditorComponent
} from "project-editor/project/EditorComponentFactory";
import type { browseGlyph } from "project-editor/features/font/FontEditor";
import type { Variable } from "project-editor/features/variable/variable";
import type { CallActionActionComponent } from "project-editor/flow/components/actions";
import type { LayoutViewWidget } from "project-editor/flow/components/widgets";

export interface IProjectEditor {
    homeTabs: Tabs;
    ProjectEditorTabClass: typeof ProjectEditorTab;
    DataContextClass: typeof DataContext;
    extensions: Extension[];
    documentSearch: IDocumentSearch;
    RemoteRuntimeClass: typeof RemoteRuntime;
    WasmRuntimeClass: typeof WasmRuntime;
    DebugInfoRuntimeClass: typeof DebugInfoRuntime;
    build: {
        buildProject: typeof build;
        backgroundCheck: typeof backgroundCheck;
        buildExtensions: typeof buildExtensions;
    };
    getAllMetrics: typeof getAllMetrics;
    ProjectClass: typeof Project;
    FlowClass: typeof Flow;
    PageClass: typeof Page;
    ActionClass: typeof Action;
    ComponentClass: typeof Component;
    ActionComponentClass: typeof ActionComponent;
    WidgetClass: typeof Widget;
    ConnectionLineClass: typeof ConnectionLine;
    LayoutViewWidgetClass: typeof LayoutViewWidget;
    CallActionActionComponentClass: typeof CallActionActionComponent;
    VariableClass: typeof Variable;
    GlyphClass: typeof Glyph;
    ScpiCommandClass: typeof ScpiCommand;
    ScpiSubsystemClass: typeof ScpiSubsystem;
    getProject: typeof getProject;
    getFlow: typeof getFlow;
    getNameProperty: typeof getNameProperty;
    getObjectVariableTypeFromType: typeof getObjectVariableTypeFromType;
    findBitmap: typeof findBitmap;
    migrateProjectVersion: typeof migrateProjectVersion;
    migrateProjectType: typeof migrateProjectType;
    getNavigationComponent: typeof getNavigationComponent;
    getNavigationObject: typeof getNavigationObject;
    navigateTo: typeof navigateTo;
    selectObject: typeof selectObject;
    getEditorComponent: typeof getEditorComponent;
    getAncestorWithEditorComponent: typeof getAncestorWithEditorComponent;
    createEditorState: typeof createEditorState;
    browseGlyph: typeof browseGlyph;
    checkAssetId: typeof checkAssetId;
}

export const ProjectEditor: IProjectEditor = {} as any;
