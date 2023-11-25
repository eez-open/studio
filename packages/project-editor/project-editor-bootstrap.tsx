import type { ProjectEditorTab, Tabs } from "home/tabs-store";

import { getProjectFeatures } from "project-editor/store/features";
import { CurrentSearch, isReferenced } from "project-editor/core/search";
import { DataContext } from "project-editor/features/variable/variable";

import {
    ProjectEditor,
    IProjectEditor
} from "project-editor/project-editor-interface";
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
    ImportDirective
} from "project-editor/project/project";

import {
    ActionComponent,
    Component,
    getWidgetParent,
    CustomInput,
    CustomOutput,
    createActionComponentClass
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
    CallActionActionComponent
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
    LVGLPanelWidget,
    LVGLUserWidgetWidget
} from "project-editor/lvgl/widgets";

import { getBitmapData } from "project-editor/features/bitmap/bitmap";
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

export function initProjectEditor(
    homeTabs: Tabs | undefined,
    ProjectEditorTabClass: typeof ProjectEditorTab
) {
    if (ProjectEditor.DataContextClass) {
        // already initialized
        return;
    }

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
        WidgetClass: Widget,
        ConnectionLineClass: ConnectionLine,
        UserWidgetWidgetClass: UserWidgetWidget,
        SelectWidgetClass: SelectWidget,
        ContainerWidgetClass: ContainerWidget,
        ListWidgetClass: ListWidget,
        OutputActionComponentClass: OutputActionComponent,
        CallActionActionComponentClass: CallActionActionComponent,
        VariableClass: Variable,
        GlyphClass: Glyph,
        ScpiCommandClass: ScpiCommand,
        ScpiSubsystemClass: ScpiSubsystem,
        StyleClass: Style,
        LVGLWidgetClass: LVGLWidget,
        LVGLPanelWidgetClass: LVGLPanelWidget,
        LVGLUserWidgetWidgetClass: LVGLUserWidgetWidget,
        LVGLStyleClass: LVGLStyle,
        getProject,
        getProjectStore,
        getFlow,
        getObjectVariableTypeFromType,
        getWidgetParent,
        rebuildLvglFonts,
        getBitmapData,
        migrateProjectVersion,
        migrateProjectType,
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
        createActionComponentClass
    };

    Object.assign(ProjectEditor, projectEditor);

    //dumpClasses();
}

/*
import { LVGLMeterIndicator } from "project-editor/lvgl/widgets";

import { isDev, writeTextFile } from "eez-studio-shared/util-electron";
import {
    EezClass,
    PropertyInfo,
    PropertyType,
    TYPE_NAMES,
    eezClassToClassNameMap,
    getAllClasses
} from "project-editor/core/object";
import { LVGLActionType } from "project-editor/lvgl/actions";

function dumpClasses() {
    class Build {
        static TAB = "    ";

        result: string;
        indentation: string;

        visited: EezClass[] = [];

        arrays: {
            eezClass: EezClass;
            property: PropertyInfo;
        }[] = [];

        startBuild() {
            this.result = "";
            this.indentation = "";
        }

        indent() {
            this.indentation += Build.TAB;
        }

        unindent() {
            this.indentation = this.indentation.substring(
                0,
                this.indentation.length - Build.TAB.length
            );
        }

        line(line: string) {
            this.result += this.indentation + line + "\n";
        }

        text(text: string) {
            this.result += text;
        }
    }

    function dumpClass(eezClass: EezClass, build: Build) {
        build.line(eezClassToClassNameMap.get(eezClass) || eezClass.name);

        if (build.visited.indexOf(eezClass) >= 0) {
            return;
        }

        if (eezClass.classInfo.parentClassInfo) {
            build.indent();
            {
                build.line("EXTENDS");
                let eezParentClass: any = undefined;

                if (eezClass.classInfo.parentClassInfo == Flow.classInfo) {
                    eezParentClass = Flow;
                } else if (
                    eezClass.classInfo.parentClassInfo == Component.classInfo
                ) {
                    eezParentClass = Component;
                } else if (
                    eezClass.classInfo.parentClassInfo ==
                    ActionComponent.classInfo
                ) {
                    eezParentClass = ActionComponent;
                } else if (
                    eezClass.classInfo.parentClassInfo == Widget.classInfo
                ) {
                    eezParentClass = Widget;
                } else if (
                    eezClass.classInfo.parentClassInfo == LVGLWidget.classInfo
                ) {
                    eezParentClass = LVGLWidget;
                } else if (
                    eezClass.classInfo.parentClassInfo ==
                    LVGLMeterIndicator.classInfo
                ) {
                    eezParentClass = LVGLMeterIndicator;
                } else if (
                    eezClass.classInfo.parentClassInfo ==
                    LVGLActionType.classInfo
                ) {
                    eezParentClass = LVGLActionType;
                }

                build.indent();
                {
                    if (eezParentClass) {
                        dumpClass(eezParentClass, build);
                    } else {
                        build.line("NOT FOUND!!!");
                    }
                }
                build.unindent();
            }
            build.unindent();
        }

        build.visited.push(eezClass);

        build.indent();
        {
            for (const property of eezClass.classInfo.properties) {
                if (eezClass.classInfo.parentClassInfo) {
                    if (
                        eezClass.classInfo.parentClassInfo.properties.indexOf(
                            property
                        ) >= 0
                    ) {
                        continue;
                    }
                }

                try {
                    build.line(
                        property.name + ": " + TYPE_NAMES[property.type]
                    );

                    if (property.type == PropertyType.Array) {
                        build.arrays.push({
                            eezClass,
                            property
                        });
                    }

                    if (property.typeClass) {
                        build.indent();
                        {
                            dumpClass(property.typeClass, build);
                        }
                        build.unindent();
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }
        build.unindent();
    }

    if (isDev) {
        const build = new Build();
        build.startBuild();
        dumpClass(Project, build);
        for (const eezClass of getAllClasses()) {
            if (build.visited.indexOf(eezClass) >= 0) {
                continue;
            }
            build.line("========================================");
            build.line("========================================");
            build.line("========================================");
            dumpClass(eezClass, build);
        }
        build.line("========================================");
        build.line("========================================");
        build.line("========================================");
        for (const array of build.arrays) {
            build.line(
                `${
                    eezClassToClassNameMap.get(array.eezClass) ||
                    array.eezClass.name
                }.${array.property.name}`
            );
        }
        build.line("========================================");
        build.line("========================================");
        build.line("========================================");
        build.line("No. of classes: " + build.visited.length);
        build.line("No. of array properties: " + build.arrays.length);
        writeTextFile("c:/work/eez/studio-classes.txt", build.result);
    }
}
*/
