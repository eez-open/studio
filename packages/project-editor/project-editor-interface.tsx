import type { ProjectEditorTab, Tabs } from "home/tabs-store";
import type { ProjectEditorFeature } from "project-editor/store/features";
import type { IDocumentSearch } from "project-editor/core/search";
import type { DataContext } from "project-editor/features/variable/variable";
import type { RemoteRuntime } from "project-editor/flow/runtime/remote-runtime";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import type { DebugInfoRuntime } from "project-editor/flow/runtime/debug-info-runtime";
import type {
    build,
    backgroundCheck,
    buildExtensions
} from "project-editor/build/build";
import type {
    checkAssetId,
    getFlow,
    getProject,
    Project,
    ImportDirective,
    BuildFile
} from "project-editor/project/project";
import type { Page } from "project-editor/features/page/page";
import type {
    ActionComponent,
    Component,
    Widget,
    getWidgetParent,
    CustomInput,
    CustomOutput,
    createActionComponentClass,
    makeExpressionProperty,
    checkProperty
} from "project-editor/flow/component";
import type {
    Glyph,
    rebuildLvglFonts
} from "project-editor/features/font/font";
import type { Flow, FlowFragment } from "project-editor/flow/flow";
import type { ConnectionLine } from "project-editor/flow/connection-line";
import type { Action } from "project-editor/features/action/action";
import type {
    ScpiCommand,
    ScpiSubsystem
} from "project-editor/features/scpi/scpi";
import type { getObjectVariableTypeFromType } from "project-editor/features/variable/value-type";
import type {
    Bitmap,
    getBitmapData
} from "project-editor/features/bitmap/bitmap";
import type { Font } from "project-editor/features/font/font";
import type {
    migrateProjectVersion,
    migrateProjectType
} from "project-editor/project/migrate-project";
import type {
    getNavigationObject,
    navigateTo,
    selectObject
} from "project-editor/project/ui/NavigationComponentFactory";
import type {
    createEditorState,
    getEditorComponent,
    getAncestorWithEditorComponent
} from "project-editor/project/ui/EditorComponentFactory";
import type { browseGlyph } from "project-editor/features/font/FontEditor";
import type { Variable } from "project-editor/features/variable/variable";
import type {
    OutputActionComponent,
    CallActionActionComponent,
    CommentActionComponent
} from "project-editor/flow/components/actions";
import type {
    ContainerWidget,
    UserWidgetWidget,
    ListWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";
import type { ArrayProperty } from "project-editor/ui-components/PropertyGrid/ArrayElementProperty";
import type { EmbeddedPropertyGrid } from "project-editor/ui-components/PropertyGrid/EmbeddedPropertyGrid";
import type {
    LVGLWidget,
    LVGLScreenWidget,
    LVGLPanelWidget,
    LVGLUserWidgetWidget,
    LVGLTabWidget,
    LVGLRollerWidget,
    LVGLButtonMatrixWidget,
    LVGLLedWidget,
    LVGLTabviewWidget,
    LVGLDropdownWidget
} from "project-editor/lvgl/widgets";
import type { LVGLStyle } from "project-editor/lvgl/style";
import type { Property } from "project-editor/ui-components/PropertyGrid/Property";
import type { getProjectStore } from "project-editor/store";

import type {
    Structure,
    StructureField,
    Enum,
    EnumMember
} from "project-editor/features/variable/variable";

import type { Style } from "project-editor/features/style/style";
import type { evalProperty } from "project-editor/flow/helper";
import type { migrateLvglVersion } from "project-editor/lvgl/migrate";
import type { FlowTabState } from "project-editor/flow/flow-tab-state";
import type { Color } from "project-editor/features/style/theme";
import type { UserProperty } from "project-editor/flow/user-property";
import type { LVGLActionComponent } from "project-editor/lvgl/actions";
import type { FlowEditor } from "project-editor/flow/editor/editor";
import type { newComponentMenuItem } from "project-editor/flow/editor/ComponentsPalette";

import type { LVGLPageEditorRuntime } from "project-editor/lvgl/page-runtime";

export interface IProjectEditor {
    homeTabs?: Tabs;
    ProjectEditorTabClass: typeof ProjectEditorTab;
    DataContextClass: typeof DataContext;
    extensions: ProjectEditorFeature[];
    documentSearch: IDocumentSearch;
    RemoteRuntimeClass: typeof RemoteRuntime;
    WasmRuntimeClass: typeof WasmRuntime;
    DebugInfoRuntimeClass: typeof DebugInfoRuntime;
    build: {
        buildProject: typeof build;
        backgroundCheck: typeof backgroundCheck;
        buildExtensions: typeof buildExtensions;
    };
    ProjectClass: typeof Project;
    FlowClass: typeof Flow;
    FlowFragmentClass: typeof FlowFragment;
    PageClass: typeof Page;
    ActionClass: typeof Action;
    ComponentClass: typeof Component;
    ActionComponentClass: typeof ActionComponent;
    CommentActionComponentClass: typeof CommentActionComponent;
    WidgetClass: typeof Widget;
    ConnectionLineClass: typeof ConnectionLine;
    UserWidgetWidgetClass: typeof UserWidgetWidget;
    SelectWidgetClass: typeof SelectWidget;
    ContainerWidgetClass: typeof ContainerWidget;
    ListWidgetClass: typeof ListWidget;
    OutputActionComponentClass: typeof OutputActionComponent;
    CallActionActionComponentClass: typeof CallActionActionComponent;
    VariableClass: typeof Variable;
    UserPropertyClass: typeof UserProperty;
    GlyphClass: typeof Glyph;
    ScpiCommandClass: typeof ScpiCommand;
    ScpiSubsystemClass: typeof ScpiSubsystem;
    StyleClass: typeof Style;
    BitmapClass: typeof Bitmap;
    FontClass: typeof Font;
    ColorClass: typeof Color;
    LVGLWidgetClass: typeof LVGLWidget;
    LVGLScreenWidgetClass: typeof LVGLScreenWidget;
    LVGLPanelWidgetClass: typeof LVGLPanelWidget;
    LVGLUserWidgetWidgetClass: typeof LVGLUserWidgetWidget;
    LVGLTabviewWidgetClass: typeof LVGLTabviewWidget;
    LVGLTabWidgetClass: typeof LVGLTabWidget;
    LVGLDropdownWidgetClass: typeof LVGLDropdownWidget;
    LVGLRollerWidgetClass: typeof LVGLRollerWidget;
    LVGLButtonMatrixWidgetClass: typeof LVGLButtonMatrixWidget;
    LVGLLedWidgetClass: typeof LVGLLedWidget;
    LVGLStyleClass: typeof LVGLStyle;
    LVGLActionComponentClass: typeof LVGLActionComponent;
    LVGLPageEditorRuntimeClass: typeof LVGLPageEditorRuntime;
    getProject: typeof getProject;
    getProjectStore: typeof getProjectStore;
    getFlow: typeof getFlow;
    getObjectVariableTypeFromType: typeof getObjectVariableTypeFromType;
    getWidgetParent: typeof getWidgetParent;
    rebuildLvglFonts: typeof rebuildLvglFonts;
    getBitmapData: typeof getBitmapData;
    migrateProjectVersion: typeof migrateProjectVersion;
    migrateProjectType: typeof migrateProjectType;
    migrateLvglVersion: typeof migrateLvglVersion;
    getNavigationObject: typeof getNavigationObject;
    navigateTo: typeof navigateTo;
    selectObject: typeof selectObject;
    getEditorComponent: typeof getEditorComponent;
    getAncestorWithEditorComponent: typeof getAncestorWithEditorComponent;
    createEditorState: typeof createEditorState;
    browseGlyph: typeof browseGlyph;
    checkAssetId: typeof checkAssetId;
    Property: typeof Property;
    ArrayProperty: typeof ArrayProperty;
    EmbeddedPropertyGrid: typeof EmbeddedPropertyGrid;
    StructureClass: typeof Structure;
    StructureFieldClass: typeof StructureField;
    EnumClass: typeof Enum;
    EnumMemberClass: typeof EnumMember;
    CustomInputClass: typeof CustomInput;
    CustomOutputClass: typeof CustomOutput;
    ImportDirectiveClass: typeof ImportDirective;
    createActionComponentClass: typeof createActionComponentClass;
    makeExpressionProperty: typeof makeExpressionProperty;
    evalProperty: typeof evalProperty;
    checkProperty: typeof checkProperty;
    FlowTabStateClass: typeof FlowTabState;
    BuildFileClass: typeof BuildFile;
    FlowEditorClass: typeof FlowEditor;
    newComponentMenuItem: typeof newComponentMenuItem;
}

export const ProjectEditor: IProjectEditor = {} as any;
