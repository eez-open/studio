import type { Extension } from "project-editor/core/extensions";
import type { IDocumentSearch } from "project-editor/core/search";
import type { DataContext } from "project-editor/features/variable/variable";
import type { LocalRuntime } from "project-editor/flow/local-runtime";
import type { RemoteRuntime } from "project-editor/flow/remote-runtime";
import type {
    build,
    backgroundCheck,
    buildExtensions
} from "project-editor/project/build";
import type { getAllMetrics } from "project-editor/project/metrics";
import type {
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
import type { EmbeddedWidget } from "project-editor/flow/widgets";
import type { ConnectionLine, Flow } from "project-editor/flow/flow";
import type { Action } from "project-editor/features/action/action";
import type {
    ScpiCommand,
    ScpiSubsystem
} from "project-editor/features/scpi/scpi";

export interface IProjectEditor {
    DataContextClass: typeof DataContext;
    extensions: Extension[];
    documentSearch: IDocumentSearch;
    LocalRuntimeClass: typeof LocalRuntime;
    RemoteRuntimeClass: typeof RemoteRuntime;
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
    EmbeddedWidgetClass: typeof EmbeddedWidget;
    ConnectionLineClass: typeof ConnectionLine;
    GlyphClass: typeof Glyph;
    ScpiCommandClass: typeof ScpiCommand;
    ScpiSubsystemClass: typeof ScpiSubsystem;
    getProject: typeof getProject;
    getFlow: typeof getFlow;
    getNameProperty: typeof getNameProperty;
}

export const ProjectEditor: IProjectEditor = {} as any;
