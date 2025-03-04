import type { ProjectEditorTab, Tabs } from "home/tabs-store";

import { getProjectFeatures } from "project-editor/store/features";
import { CurrentSearch, isReferenced } from "project-editor/core/search";
import { DataContext } from "project-editor/features/variable/variable";

import type { IProjectEditor } from "project-editor/project-editor-interface";
import { RemoteRuntime } from "project-editor/flow/runtime/remote-runtime";
import { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import { DebugInfoRuntime } from "project-editor/flow/runtime/debug-info-runtime";
import {
    build as buildProject,
    backgroundCheck,
    buildExtensions
} from "project-editor/build/build";
import {
    getProject,
    getFlow,
    Project,
    checkObjectReference,
    checkAssetId,
    ImportDirective,
    BuildFile
} from "project-editor/project/project";

import {
    ActionComponent,
    Component,
    getWidgetParent,
    CustomInput,
    CustomOutput,
    createActionComponentClass,
    makeExpressionProperty,
    checkProperty
} from "project-editor/flow/component";

import { Page } from "project-editor/features/page/page";
import { Widget } from "project-editor/flow/component";
import { Glyph, rebuildLvglFonts } from "project-editor/features/font/font";
import { Flow, FlowFragment } from "project-editor/flow/flow";
import { ConnectionLine } from "project-editor/flow/connection-line";
import { Action } from "project-editor/features/action/action";
import { ScpiCommand, ScpiSubsystem } from "project-editor/features/scpi/scpi";
import { getObjectVariableTypeFromType } from "project-editor/features/variable/value-type";

// ACTIONS
import {
    OutputActionComponent,
    CallActionActionComponent,
    CommentActionComponent
} from "project-editor/flow/components/actions";
import "project-editor/flow/components/actions/execute-command";
import "project-editor/flow/components/actions/stream";
import "project-editor/flow/components/actions/file";
import "project-editor/flow/components/actions/instrument";
import "project-editor/flow/components/actions/regexp";
import "project-editor/flow/components/actions/serial";
import "project-editor/flow/components/actions/http";
import "project-editor/flow/components/actions/json";
import "project-editor/flow/components/actions/python";
import "project-editor/flow/components/actions/mqtt-actions";
import "project-editor/flow/components/actions/csv";
import "project-editor/flow/components/actions/modbus";
import "project-editor/flow/components/actions/tabulator";
import "project-editor/flow/components/actions/tcp";
import "project-editor/lvgl/actions";

// WIDGETS
import {
    ContainerWidget,
    UserWidgetWidget,
    ListWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";
import "project-editor/flow/components/widgets/dashboard";
import "project-editor/flow/components/widgets/eez-gui";
import {
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

// ACTIONS: udp
import "project-editor/flow/components/actions/udp";

import { Bitmap, getBitmapData } from "project-editor/features/bitmap/bitmap";
import { Font } from "project-editor/features/font/font";
import {
    migrateProjectVersion,
    migrateProjectType
} from "project-editor/project/migrate-project";
import {
    getNavigationObject,
    navigateTo,
    selectObject
} from "project-editor/project/ui/NavigationComponentFactory";
import {
    createEditorState,
    getEditorComponent,
    getAncestorWithEditorComponent
} from "project-editor/project/ui/EditorComponentFactory";
import { browseGlyph } from "project-editor/features/font/FontEditor";
import { Variable } from "project-editor/features/variable/variable";
import { ArrayProperty } from "project-editor/ui-components/PropertyGrid/ArrayElementProperty";
import { EmbeddedPropertyGrid } from "project-editor/ui-components/PropertyGrid/EmbeddedPropertyGrid";
import { LVGLStyle } from "project-editor/lvgl/style";
import { Property } from "./ui-components/PropertyGrid/Property";
import { getProjectStore } from "project-editor/store";

import {
    Structure,
    StructureField,
    Enum,
    EnumMember
} from "project-editor/features/variable/variable";

import { Style } from "project-editor/features/style/style";

import { evalProperty } from "project-editor/flow/helper";
import { migrateLvglVersion } from "./lvgl/migrate";
import { FlowTabState } from "project-editor/flow/flow-tab-state";
import { Color } from "project-editor/features/style/theme";
import { UserProperty } from "./flow/user-property";
import { LVGLActionComponent } from "project-editor/lvgl/actions";
import { FlowEditor } from "project-editor/flow/editor/editor";
import { newComponentMenuItem } from "project-editor/flow/editor/ComponentsPalette";

import { LVGLPageEditorRuntime } from "project-editor/lvgl/page-runtime";

export async function createProjectEditor(
    homeTabs: Tabs | undefined,
    ProjectEditorTabClass: typeof ProjectEditorTab
) {
    // (window as any).__eezProjectMigration = {
    //     displaySourceWidth: 480,
    //     displaySourceHeight: 272,
    //     displayTargetWidth: 800,
    //     displayTargetHeight: 480,
    //     fonts: {
    //         Oswald_9: "Oswald_12",
    //         Oswald_12: "Oswald_17",
    //         Oswald_17: "Oswald_24"
    //     }
    // };

    const projectEditor: IProjectEditor = {
        homeTabs,
        ProjectEditorTabClass,
        DataContextClass: DataContext,
        extensions: getProjectFeatures(),
        documentSearch: {
            CurrentSearch,
            isReferenced,
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
        ProjectClass: Project,
        FlowClass: Flow,
        FlowFragmentClass: FlowFragment,
        PageClass: Page,
        ActionClass: Action,
        ComponentClass: Component,
        ActionComponentClass: ActionComponent,
        CommentActionComponentClass: CommentActionComponent,
        WidgetClass: Widget,
        ConnectionLineClass: ConnectionLine,
        UserWidgetWidgetClass: UserWidgetWidget,
        SelectWidgetClass: SelectWidget,
        ContainerWidgetClass: ContainerWidget,
        ListWidgetClass: ListWidget,
        OutputActionComponentClass: OutputActionComponent,
        CallActionActionComponentClass: CallActionActionComponent,
        VariableClass: Variable,
        UserPropertyClass: UserProperty,
        GlyphClass: Glyph,
        ScpiCommandClass: ScpiCommand,
        ScpiSubsystemClass: ScpiSubsystem,
        StyleClass: Style,
        BitmapClass: Bitmap,
        FontClass: Font,
        ColorClass: Color,
        LVGLWidgetClass: LVGLWidget,
        LVGLScreenWidgetClass: LVGLScreenWidget,
        LVGLPanelWidgetClass: LVGLPanelWidget,
        LVGLUserWidgetWidgetClass: LVGLUserWidgetWidget,
        LVGLTabviewWidgetClass: LVGLTabviewWidget,
        LVGLTabWidgetClass: LVGLTabWidget,
        LVGLDropdownWidgetClass: LVGLDropdownWidget,
        LVGLRollerWidgetClass: LVGLRollerWidget,
        LVGLButtonMatrixWidgetClass: LVGLButtonMatrixWidget,
        LVGLLedWidgetClass: LVGLLedWidget,
        LVGLStyleClass: LVGLStyle,
        LVGLActionComponentClass: LVGLActionComponent,
        LVGLPageEditorRuntimeClass: LVGLPageEditorRuntime,
        getProject,
        getProjectStore,
        getFlow,
        getObjectVariableTypeFromType,
        getWidgetParent,
        rebuildLvglFonts,
        getBitmapData,
        migrateProjectVersion,
        migrateProjectType,
        migrateLvglVersion,
        getNavigationObject,
        navigateTo,
        selectObject,
        getEditorComponent,
        getAncestorWithEditorComponent,
        createEditorState,
        browseGlyph,
        checkAssetId,
        Property,
        ArrayProperty,
        EmbeddedPropertyGrid,
        StructureClass: Structure,
        StructureFieldClass: StructureField,
        EnumClass: Enum,
        EnumMemberClass: EnumMember,
        CustomInputClass: CustomInput,
        CustomOutputClass: CustomOutput,
        ImportDirectiveClass: ImportDirective,
        createActionComponentClass,
        makeExpressionProperty,
        evalProperty,
        checkProperty,
        FlowTabStateClass: FlowTabState,
        BuildFileClass: BuildFile,
        FlowEditorClass: FlowEditor,
        newComponentMenuItem
    };

    return projectEditor;
}
