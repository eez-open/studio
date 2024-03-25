import path from "path";
import { ipcRenderer } from "electron";
import React from "react";
import { observable, makeObservable, autorun } from "mobx";
import { observer } from "mobx-react";

import type { IDashboardComponentContext } from "eez-studio-types";

import { makeLazyComponent } from "eez-studio-ui/lazy-component";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType,
    IMessage,
    EezObject,
    ClassInfo,
    PropertyProps,
    PropertyInfo,
    findPropertyByNameInClassInfo
} from "project-editor/core/object";

import {
    makeDataPropertyInfo,
    makeExpressionProperty,
    makeStylePropertyInfo,
    Widget
} from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { Loader } from "eez-studio-ui/loader";
import { Button } from "eez-studio-ui/button";

import { EMBEDDED_DASHBOARD_WIDGET_ICON } from "project-editor/ui-components/icons";
import { ProjectStore, propertyNotSetMessage } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditorView } from "project-editor/project/ui/ProjectEditor";
import { evalProperty } from "project-editor/flow/helper";
import { createWasmValue } from "project-editor/flow/runtime/wasm-value";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";

////////////////////////////////////////////////////////////////////////////////

interface Props {
    widget: EmbeddedDashboardWidget;
    flowContext: IFlowContext;
    width: number;
    height: number;
}

const EmbeddedDashboardElement = makeLazyComponent(
    async (props: Props) => {
        let projectStore: ProjectStore | undefined;

        let loadError;
        let autorunDispose;

        if (props.flowContext.flowState && props.widget.dashboard) {
            const parentProjectStore = props.flowContext.projectStore;

            const dashboardFilePath = parentProjectStore.getAbsoluteFilePath(
                props.widget.dashboard
            );

            try {
                projectStore = await ProjectStore.create({
                    type: "run-embedded"
                });
                projectStore.mount();
                await projectStore.openFile(dashboardFilePath);
                projectStore.project._fullyLoaded = true;
                projectStore.setRuntimeMode(false);

                const WasmRuntime = projectStore!.runtime! as WasmRuntime;

                // wait unit embbedded dashboard is initialized
                await new Promise<void>(resolve => {
                    WasmRuntime.onInitialized = resolve;
                });

                autorunDispose = autorun(() => {
                    for (
                        let i = 0;
                        i < props.widget.dashboardParameters.length;
                        i++
                    ) {
                        const value = evalProperty(
                            props.flowContext,
                            props.widget,
                            `dashboardParameters[${i}].value`
                        );

                        if (WasmRuntime.worker && WasmRuntime.assetsMap) {
                            const WasmFlowRuntime = WasmRuntime.worker.wasm;
                            const assetsMap = WasmRuntime.assetsMap;
                            const globalVariable =
                                assetsMap.globalVariables.find(
                                    globalVariable =>
                                        globalVariable.name ==
                                        props.widget.dashboardParameters[i].name
                                );
                            if (globalVariable != undefined) {
                                const valuePtr = createWasmValue(
                                    WasmFlowRuntime,
                                    value,
                                    parseInt(
                                        assetsMap.typeIndexes[
                                            globalVariable.type
                                        ]
                                    )
                                );
                                WasmFlowRuntime._setGlobalVariable(
                                    globalVariable.index,
                                    valuePtr
                                );
                                WasmFlowRuntime._valueFree(valuePtr);
                            } else {
                                // TODO
                                console.error(
                                    "Invalid dashboard parameter",
                                    props.widget.dashboardParameters[i].name
                                );
                            }
                        }
                    }
                });
            } catch (err) {
                loadError = err.toString();
                let i = loadError.indexOf("ENOENT:");
                if (i != -1) {
                    loadError = `Failed to load: ${dashboardFilePath}`;
                }
            }
        }

        return { projectStore, loadError, autorunDispose };
    },
    ({ projectStore, loadError }, props: Props) => {
        let style: React.CSSProperties = {
            display: "flex",
            height: "100%",
            backgroundColor: "white"
        };
        let content;

        if (props.flowContext.projectStore.runtime) {
            if (projectStore) {
                if (loadError) {
                    content = loadError;
                    style.alignItems = "center";
                    style.justifyContent = "center";
                } else {
                    content = (
                        <ProjectContext.Provider value={projectStore}>
                            <ProjectEditorView showToolbar={false} />
                        </ProjectContext.Provider>
                    );
                }
            } else {
                content = <Loader />;
                style.alignItems = "center";
                style.justifyContent = "center";
            }
        } else {
            content = (
                <>
                    <p>Embedded dashboard:</p>
                    <pre>
                        {props.widget.dashboard
                            ? path.basename(props.widget.dashboard)
                            : "<not specified>"}
                    </pre>
                </>
            );
            style.flexDirection = "column";
            style.alignItems = "center";
            style.justifyContent = "center";
        }

        return <div style={style}>{content}</div>;
    },
    (lazyData?) => {
        if (lazyData?.autorunDispose) {
            lazyData?.autorunDispose();
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const OpenEmbeddedDashboard = observer(
    class OpenEmbeddedDashboard extends React.Component<PropertyProps> {
        openDashboard = () => {
            ipcRenderer.send(
                "open-file",
                (this.props.objects[0] as EmbeddedDashboardWidget).dashboard
            );
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <div style={{ margin: "4px 0" }}>
                    <Button
                        color="primary"
                        size="small"
                        onClick={this.openDashboard}
                    >
                        Open Dashboard
                    </Button>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class DashboardParameterDefinition extends EezObject {
    name: string;
    value: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String
            },
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText
                },
                "any"
            )
        ],
        defaultValue: {},
        listLabel: (waveformDefinition: DashboardParameterDefinition) =>
            waveformDefinition.name
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            value: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class EmbeddedDashboardWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteLabel: "Embedded Dashboard",

        properties: [
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true
            }),
            {
                name: "dashboard",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] }
                ],
                propertyGridGroup: specificGroup
            },
            {
                name: "openDashboard",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridRowComponent: OpenEmbeddedDashboard,
                skipSearch: true,
                hideInPropertyGrid: (widget: EmbeddedDashboardWidget) =>
                    !widget.dashboard
            },
            {
                name: "dashboardParameters",
                type: PropertyType.Array,
                typeClass: DashboardParameterDefinition,
                propertyGridGroup: specificGroup,
                arrayItemOrientation: "horizontal",
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                hasExpressionProperties: true
            },
            makeStylePropertyInfo("style", "Default style")
        ],

        getAdditionalFlowProperties: (widget: EmbeddedDashboardWidget) => {
            const properties: PropertyInfo[] = [];
            for (let i = 0; i < widget.dashboardParameters.length; i++) {
                properties.push(
                    Object.assign(
                        {},
                        findPropertyByNameInClassInfo(
                            DashboardParameterDefinition.classInfo,
                            "value"
                        ),
                        {
                            name: `dashboardParameters[${i}].value`
                        }
                    )
                );
            }
            return properties;
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 430,
            height: 560,
            dashboardParameters: []
        },

        icon: EMBEDDED_DASHBOARD_WIDGET_ICON,

        check: (widget: EmbeddedDashboardWidget, messages: IMessage[]) => {
            if (!widget.dashboard) {
                messages.push(propertyNotSetMessage(widget, "dashboard"));
            }
        },

        execute: (context: IDashboardComponentContext) => {}
    });

    dashboard: string;
    dashboardParameters: DashboardParameterDefinition[];

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            dashboard: observable,
            dashboardParameters: observable
        });
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <EmbeddedDashboardElement
                    widget={this}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

registerClass("EmbeddedDashboardWidget", EmbeddedDashboardWidget);
