import type { ProjectEditorTab, Tabs } from "home/tabs-store";
import { ProjectEditor } from "project-editor/project-editor-interface";

export async function initProjectEditor(
    homeTabs: Tabs | undefined,
    ProjectEditorTabClass: typeof ProjectEditorTab
) {
    if (ProjectEditor.DataContextClass) {
        if (homeTabs && !ProjectEditor.homeTabs) {
            ProjectEditor.homeTabs = homeTabs;
        }

        if (ProjectEditorTabClass && !ProjectEditor.ProjectEditorTabClass) {
            ProjectEditor.ProjectEditorTabClass = ProjectEditorTabClass;
        }

        // already initialized
        return;
    }

    const { createProjectEditor } = await import(
        "project-editor/project-editor-create"
    );

    const projectEditor = await createProjectEditor(
        homeTabs,
        ProjectEditorTabClass
    );

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
