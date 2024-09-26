import React from "react";
import { observer } from "mobx-react";
import { observable, makeObservable, computed, runInAction } from "mobx";

import {
    IMessage,
    MessageType,
    PropertyProps,
    PropertyType,
    makeDerivedClassInfo,
    setParent
} from "project-editor/core/object";

import {
    findPage,
    getProject,
    ProjectType
} from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";
import { Button } from "eez-studio-ui/button";
import { COMPONENT_TYPE_LVGL_USER_WIDGET } from "project-editor/flow/components/component-types";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { USER_WIDGET_ICON } from "project-editor/ui-components/icons";
import {
    clipboardDataToObject,
    getAncestorOfType,
    getChildOfObject,
    getObjectPathAsString,
    getProjectStore,
    Message,
    objectToClipboardData,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    updateObject
} from "project-editor/store";
import { Page } from "project-editor/features/page/page";
import { visitObjects } from "project-editor/core/search";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { ComponentInput, ComponentOutput } from "project-editor/flow/component";
import {
    EndActionComponent,
    InputActionComponent,
    OutputActionComponent,
    StartActionComponent
} from "project-editor/flow/components/actions";
import {
    bg_opa_property_info,
    border_width_property_info,
    pad_bottom_property_info,
    pad_left_property_info,
    pad_right_property_info,
    pad_top_property_info
} from "../style-catalog";
import { Assets, DataBuffer } from "project-editor/build/assets";
import {
    userPropertyValuesProperty,
    getAdditionalFlowPropertiesForUserProperties,
    UserPropertyValues
} from "project-editor/flow/user-property";

////////////////////////////////////////////////////////////////////////////////

const LVGLUserWidgetWidgetPropertyGridUI = observer(
    class LVGLUserWidgetWidgetPropertyGridUI extends React.Component<PropertyProps> {
        showUserWidgetPage = () => {
            (this.props.objects[0] as LVGLUserWidgetWidget).open();
        };

        fitSize = () => {
            (this.props.objects[0] as LVGLUserWidgetWidget).fitSize();
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <div style={{ marginTop: 5, marginBottom: 5 }}>
                    <Button
                        color="primary"
                        size="small"
                        onClick={this.showUserWidgetPage}
                    >
                        Show User Widget
                    </Button>
                    <Button
                        color="secondary"
                        size="small"
                        onClick={this.fitSize}
                        style={{ marginLeft: 10 }}
                    >
                        Fit to User Widget Size
                    </Button>
                </div>
            );
        }
    }
);

export class LVGLUserWidgetWidget extends LVGLWidget {
    userWidgetPageName: string;
    userPropertyValues: UserPropertyValues;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        flowComponentId: COMPONENT_TYPE_LVGL_USER_WIDGET,

        componentPaletteGroupName: "!1Basic",

        label: (widget: LVGLUserWidgetWidget) => {
            let name = getComponentName(widget.type);

            if (widget.identifier) {
                name = `${name} [${widget.identifier}]`;
            }

            if (widget.userWidgetPageName) {
                return `${name}: ${widget.userWidgetPageName}`;
            }

            return name;
        },

        properties: [
            {
                name: "userWidgetPageName",
                displayName: "User widget",
                type: PropertyType.ObjectReference,
                propertyGridGroup: specificGroup,
                referencedObjectCollectionPath: "userWidgets"
            },
            userPropertyValuesProperty,
            {
                name: "customUI",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridRowComponent: LVGLUserWidgetWidgetPropertyGridUI,
                skipSearch: true,
                hideInPropertyGrid: (widget: LVGLUserWidgetWidget) => {
                    if (!widget.userWidgetPageName) {
                        return true;
                    }

                    const project = getProject(widget);

                    const userWidgetPage = findPage(
                        project,
                        widget.userWidgetPageName
                    );
                    if (!userWidgetPage) {
                        return true;
                    }

                    return false;
                }
            }
        ],

        getAdditionalFlowProperties:
            getAdditionalFlowPropertiesForUserProperties,

        defaultValue: {
            left: 0,
            top: 0,
            width: 100,
            height: 50,
            clickableFlag: true
        },

        icon: USER_WIDGET_ICON,

        lvgl: {
            parts: ["MAIN", "SCROLLBAR"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        },

        check: (widget: LVGLUserWidgetWidget, messages: IMessage[]) => {
            if (!widget.userWidgetPageName) {
                messages.push(
                    propertyNotSetMessage(widget, "userWidgetPageName")
                );
            } else {
                let userWidgetPage = findPage(
                    getProject(widget),
                    widget.userWidgetPageName
                );

                if (!userWidgetPage) {
                    messages.push(
                        propertyNotFoundMessage(widget, "userWidgetPageName")
                    );
                } else {
                    if (!userWidgetPage.isUsedAsUserWidget) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Page "${userWidgetPage.name}" is not an user widget page`,
                                widget
                            )
                        );
                    }

                    if (widget.isCycleDetected) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Cycle detected in user widget page`,
                                getChildOfObject(widget, "userWidgetPageName")
                            )
                        );
                    }
                }
            }
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            userWidgetPage: computed,
            isCycleDetected: computed,
            userWidgetPageCopy: computed({ keepAlive: true })
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            userWidgetPageName: observable,
            userPropertyValues: observable
        });
    }

    override getIsAccessibleFromSourceCode() {
        return true;
    }

    get userWidgetPage(): Page | undefined {
        if (!this.userWidgetPageName) {
            return undefined;
        }

        return findPage(getProject(this), this.userWidgetPageName);
    }

    get isCycleDetected() {
        const visited = new Set<Page>();

        function testForCycle(page: Page): boolean {
            if (visited.has(page)) {
                return false;
            }

            visited.add(page);

            for (const widget of visitObjects(page)) {
                if (widget instanceof ProjectEditor.LVGLUserWidgetWidgetClass) {
                    if (widget.userWidgetPageName) {
                        const userWidgetPage = findPage(
                            project,
                            widget.userWidgetPageName
                        );
                        if (userWidgetPage) {
                            if (userWidgetPage === origPage) {
                                return true;
                            }
                            if (testForCycle(userWidgetPage)) {
                                return true;
                            }
                        }
                    }
                }
            }

            return false;
        }

        if (!this.userWidgetPageName) {
            return false;
        }

        const project = getProject(this);

        const userWidgetPage = findPage(project, this.userWidgetPageName);
        if (!userWidgetPage) {
            return false;
        }

        const origPage = getAncestorOfType(
            this,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        return testForCycle(userWidgetPage);
    }

    _userWidgetPageCopyIds: string[] = [];

    get userWidgetPageCopy(): Page | undefined {
        const page = this.userWidgetPage;

        if (!page) {
            return undefined;
        }

        const project = ProjectEditor.getProject(page);
        const projectStore = project._store;

        let userWidgetPageCopy: Page | undefined = undefined;

        // WORKAROUND: projectStore.lastRevisionStable is read to detect if the page was modified
        projectStore.lastRevisionStable;

        // runInAction is needed to avoid observing copied page
        runInAction(() => {
            const idsBefore = new Set(projectStore.objects.keys());

            userWidgetPageCopy = clipboardDataToObject(
                projectStore,
                objectToClipboardData(projectStore, page)
            ).object as Page;
            setParent(userWidgetPageCopy, project.userWidgets);

            for (const id of this._userWidgetPageCopyIds) {
                projectStore.objects.delete(id);
            }
            this._userWidgetPageCopyIds = [];
            for (const id of projectStore.objects.keys()) {
                if (!idsBefore.has(id)) {
                    this._userWidgetPageCopyIds.push(id);
                }
            }

            userWidgetPageCopy._lvglUserWidgetOfPageCopy = this;
        });

        return userWidgetPageCopy;
    }

    open() {
        if (this.userWidgetPage) {
            getProjectStore(this).navigationStore.showObjects(
                [this.userWidgetPage],
                true,
                false,
                false
            );
        }
    }

    fitSize() {
        if (this.userWidgetPage) {
            updateObject(this, {
                width: this.userWidgetPage.rect.width,
                height: this.userWidgetPage.rect.height
            });
        }
    }

    getInputs() {
        const page = findPage(getProject(this), this.userWidgetPageName);
        if (!page) {
            return super.getInputs();
        }

        const startComponents: ComponentInput[] = page.components
            .filter(component => component instanceof StartActionComponent)
            .map(() => ({
                name: "@seqin",
                type: "null",
                isSequenceInput: true,
                isOptionalInput: true
            }));

        const inputComponents: ComponentInput[] = page.components
            .filter(component => component instanceof InputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((inputActionComponent: InputActionComponent) => ({
                name: inputActionComponent.objID,
                displayName: inputActionComponent.name,
                type: inputActionComponent.inputType,
                isSequenceInput: false,
                isOptionalInput: false
            }));

        return [...startComponents, ...inputComponents, ...super.getInputs()];
    }

    getOutputs() {
        const page = findPage(getProject(this), this.userWidgetPageName);
        if (!page) {
            return super.getOutputs();
        }

        const endComponents: ComponentOutput[] = page.components
            .filter(component => component instanceof EndActionComponent)
            .map(() => ({
                name: "@seqout",
                type: "any",
                isSequenceOutput: true,
                isOptionalOutput: true
            }));

        const outputComponents: ComponentOutput[] = page.components
            .filter(component => component instanceof OutputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((outputActionComponent: OutputActionComponent) => ({
                name: outputActionComponent.objID,
                displayName: outputActionComponent.name,
                type: outputActionComponent.outputType,
                isSequenceOutput: false,
                isOptionalOutput: false
            }));

        return [...endComponents, ...outputComponents, ...super.getOutputs()];
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const widgetIndex = runtime.getWidgetIndex(this);

        const userWidgetPageCopy = this.userWidgetPageCopy;

        if (!userWidgetPageCopy || this.isCycleDetected) {
            const rect = this.getLvglCreateRect();

            return runtime.wasm._lvglCreateUserWidget(
                parentObj,
                widgetIndex,

                rect.left,
                rect.top,
                rect.width,
                rect.height
            );
        }

        const savedUserWidgetContext = runtime.lvglCreateContext;

        if (runtime.wasm.assetsMap) {
            const flow =
                runtime.wasm.assetsMap.flows[savedUserWidgetContext.pageIndex];
            const componentPath = getObjectPathAsString(this);
            const componentIndex = flow.componentIndexes[componentPath];

            runtime.lvglCreateContext = {
                widgetIndex:
                    savedUserWidgetContext.widgetIndex + widgetIndex + 1,
                pageIndex:
                    runtime.wasm.assetsMap.flowIndexes[
                        getObjectPathAsString(this.userWidgetPage!)
                    ],
                flowState: savedUserWidgetContext.flowState
                    ? runtime.wasm._lvglGetFlowState(
                          savedUserWidgetContext.flowState,
                          componentIndex
                      )
                    : 0
            };
        }

        const rect = this.getLvglCreateRect();

        const obj = userWidgetPageCopy.lvglCreate(runtime, parentObj, {
            widgetIndex,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });

        runtime.lvglCreateContext = savedUserWidgetContext;

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_obj_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        this.buildStyleIfNotDefined(build, pad_left_property_info);
        this.buildStyleIfNotDefined(build, pad_top_property_info);
        this.buildStyleIfNotDefined(build, pad_right_property_info);
        this.buildStyleIfNotDefined(build, pad_bottom_property_info);
        this.buildStyleIfNotDefined(build, bg_opa_property_info);
        this.buildStyleIfNotDefined(build, border_width_property_info);

        const userWidgetPage = findPage(
            getProject(this),
            this.userWidgetPageName
        );
        if (userWidgetPage && !this.isCycleDetected) {
            let componentIndex = build.assets.getComponentIndex(this);

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let startWidgetIndex = (
                build.getWidgetObjectIndex(this) + 1
            ).toString();

            if (page.isUsedAsUserWidget) {
                startWidgetIndex = `startWidgetIndex + ${startWidgetIndex}`;
            }

            if (build.project.projectTypeTraits.hasFlowSupport) {
                build.line(
                    `${build.getScreenCreateFunctionName(
                        userWidgetPage
                    )}(obj, getFlowState(flowState, ${componentIndex}), ${startWidgetIndex});`
                );
            } else {
                build.line(
                    `${build.getScreenCreateFunctionName(
                        userWidgetPage
                    )}(obj, ${startWidgetIndex});`
                );
            }
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        const userWidgetPage = findPage(
            getProject(this),
            this.userWidgetPageName
        );
        if (userWidgetPage && !this.isCycleDetected) {
            let componentIndex = build.assets.getComponentIndex(this);

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let startWidgetIndex = (
                build.getWidgetObjectIndex(this) + 1
            ).toString();

            if (page.isUsedAsUserWidget) {
                startWidgetIndex = `startWidgetIndex + ${startWidgetIndex}`;
            }

            if (build.project.projectTypeTraits.hasFlowSupport) {
                build.line(
                    `${build.getScreenTickFunctionName(
                        userWidgetPage
                    )}(getFlowState(flowState, ${componentIndex}), ${startWidgetIndex});`
                );
            } else {
                build.line(
                    `${build.getScreenTickFunctionName(
                        userWidgetPage
                    )}(${startWidgetIndex});`
                );
            }
        }
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const userWidgetPage = this.userWidgetPage;
        if (userWidgetPage) {
            // flowIndex
            const flowIndex = assets.flows.indexOf(userWidgetPage);
            dataBuffer.writeInt16(flowIndex);

            // inputsStartIndex
            if (userWidgetPage.inputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildInputs.findIndex(
                        input =>
                            input.name ==
                            userWidgetPage.inputComponents[0].objID
                    )
                );
            } else {
                dataBuffer.writeUint8(1);
            }

            // outputsStartIndex
            if (userWidgetPage.outputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildOutputs.findIndex(
                        output =>
                            output.name ==
                            userWidgetPage.outputComponents[0].objID
                    )
                );
            } else {
                dataBuffer.writeUint8(0);
            }

            // widgetStartIndex
            const widgetStartIndex =
                ProjectEditor.getProjectStore(
                    this
                ).lvglIdentifiers.getIdentifier(this).index + 1;
            dataBuffer.writeInt32(widgetStartIndex);
        } else {
            // flowIndex
            dataBuffer.writeInt16(-1);
            // inputsStartIndex
            dataBuffer.writeUint8(0);
            // outputsStartIndex
            dataBuffer.writeUint8(0);
            // widgetStartIndex
            dataBuffer.writeInt32(0);
        }
    }
}
