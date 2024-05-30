import path from "path";
import { ipcRenderer } from "electron";
import React from "react";
import {
    observable,
    makeObservable,
    autorun,
    action,
    IReactionDisposer,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

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

import { Button } from "eez-studio-ui/button";

import { EMBEDDED_DASHBOARD_WIDGET_ICON } from "project-editor/ui-components/icons";
import {
    getObjectPathAsString,
    ProjectStore,
    propertyNotSetMessage
} from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditorView } from "project-editor/project/ui/ProjectEditor";
import { evalProperty, getStringValue } from "project-editor/flow/helper";
import { createWasmValue } from "project-editor/flow/runtime/wasm-value";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import { isValidUrl } from "project-editor/core/util";
import { evalConstantExpression } from "project-editor/flow/expression";

////////////////////////////////////////////////////////////////////////////////

class LoadDashboard {
    projectStore: ProjectStore | undefined;
    loadError: string | undefined;

    autorunDispose: IReactionDisposer | undefined;
    unmounted: boolean = false;

    constructor(
        public flowContext: IFlowContext,
        public widget: EmbeddedDashboardWidget,
        public dashboardFilePath: string
    ) {
        makeObservable(this, {
            projectStore: observable,
            loadError: observable,
            unmount: action
        });
    }

    async load() {
        const projectStore = ProjectStore.create({
            type: "run-embedded",
            parentProjectStore: this.flowContext.projectStore,
            dashboardPath: getObjectPathAsString(this.widget)
        });

        projectStore.mount();

        try {
            await projectStore.openFile(this.dashboardFilePath);

            if (this.unmounted) {
                await projectStore.closeWindow();
                projectStore.unmount();
            } else {
                projectStore.project._fullyLoaded = true;
                projectStore.setRuntimeMode(false);

                const WasmRuntime = projectStore!.runtime! as WasmRuntime;
                WasmRuntime.onInitialized = async () => {
                    runInAction(() => {
                        this.projectStore = projectStore;
                        this.loadError = undefined;
                    });

                    this.updateGlobalVariablesWithDashboardParameters();
                };
            }
        } catch (err) {
            await projectStore.closeWindow();
            projectStore.unmount();

            if (!this.unmounted) {
                let loadError = err.toString();
                let i = loadError.indexOf("ENOENT:");
                if (i != -1) {
                    loadError = `Failed to load: ${this.dashboardFilePath}`;
                }

                runInAction(() => (this.loadError = loadError));
            }
        }
    }

    updateGlobalVariablesWithDashboardParameters() {
        this.autorunDispose = autorun(() => {
            for (let i = 0; i < this.widget.dashboardParameters.length; i++) {
                const value = evalProperty(
                    this.flowContext,
                    this.widget,
                    `dashboardParameters[${i}].value`
                );

                const WasmRuntime = this.projectStore!.runtime! as WasmRuntime;
                const WasmFlowRuntime = WasmRuntime.worker.wasm;
                const assetsMap = WasmRuntime.assetsMap;
                const globalVariable = assetsMap.globalVariables.find(
                    globalVariable =>
                        globalVariable.name ==
                        this.widget.dashboardParameters[i].name
                );
                if (globalVariable != undefined) {
                    const valuePtr = createWasmValue(
                        WasmFlowRuntime,
                        value,
                        parseInt(assetsMap.typeIndexes[globalVariable.type])
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
                        this.widget.dashboardParameters[i].name
                    );
                }
            }
        });
    }

    async unmount() {
        if (this.autorunDispose) {
            this.autorunDispose();
        }

        if (this.projectStore) {
            await this.projectStore.closeWindow();
            this.projectStore.unmount();
            this.projectStore = undefined;
        }

        this.unmounted = true;
    }
}

////////////////////////////////////////////////////////////////////////////////

const EmbeddedDashboardElement = observer(
    class EmbeddedDashboardElement extends React.Component<{
        widget: EmbeddedDashboardWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }> {
        loadDashboard: LoadDashboard | undefined;
        error: string | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                loadDashboard: observable,
                error: observable,
                doLoadDashboard: action
            });
        }

        doLoadDashboard() {
            if (!this.props.flowContext.flowState) {
                if (this.loadDashboard) {
                    this.loadDashboard.unmount();
                    this.loadDashboard = undefined;
                }
                return;
            }

            const dashboardFilePath = this.props.widget.getDashboard(
                this.props.flowContext
            );

            if (this.loadDashboard) {
                if (this.loadDashboard.dashboardFilePath == dashboardFilePath) {
                    return;
                }
                this.loadDashboard.unmount();
                this.loadDashboard = undefined;
            }

            if (dashboardFilePath) {
                const parentProjectStore = this.props.flowContext.projectStore;

                const isCycleDetected = (
                    parentProjectStore: ProjectStore
                ): boolean => {
                    if (dashboardFilePath == parentProjectStore.filePath) {
                        return true;
                    }

                    if (parentProjectStore.context.type == "run-embedded") {
                        return isCycleDetected(
                            parentProjectStore.context.parentProjectStore
                        );
                    }

                    return false;
                };

                if (isCycleDetected(parentProjectStore)) {
                    this.error = "Cycle detected in Embedded Dashboard widget";
                } else {
                    this.error = undefined;
                    this.loadDashboard = new LoadDashboard(
                        this.props.flowContext,
                        this.props.widget,
                        dashboardFilePath
                    );
                    this.loadDashboard.load();
                }
            } else {
                if (!this.props.flowContext.projectStore.runtime) {
                    this.error = "Dashboard not specified";
                }
            }
        }

        componentDidMount() {
            this.doLoadDashboard();
        }

        componentDidUpdate() {
            this.doLoadDashboard();
        }

        componentWillUnmount(): void {
            if (this.loadDashboard) {
                this.loadDashboard.unmount();
            }
        }

        render() {
            let style: React.CSSProperties = {
                display: "flex",
                height: "100%"
            };
            let content;

            if (this.props.flowContext.projectStore.runtime) {
                this.props.widget.getDashboard(this.props.flowContext);

                if (this.error) {
                    content = this.error;
                    style.alignItems = "center";
                    style.justifyContent = "center";
                } else if (this.loadDashboard?.loadError) {
                    content = this.loadDashboard.loadError;
                    style.alignItems = "center";
                    style.justifyContent = "center";
                } else if (this.loadDashboard?.projectStore) {
                    content = (
                        <ProjectContext.Provider
                            value={this.loadDashboard.projectStore}
                        >
                            <ProjectEditorView showToolbar={false} />
                        </ProjectContext.Provider>
                    );
                } else {
                    content = null;
                    style.alignItems = "center";
                    style.justifyContent = "center";
                }
            } else {
                content = (
                    <>
                        <p>Embedded dashboard:</p>
                        <pre className="EezStudio_EmbeddedDashboardWidget_Pre">
                            {this.props.widget.getDashboardInfo(
                                this.props.flowContext
                            )}
                        </pre>
                    </>
                );
                style.flexDirection = "column";
                style.alignItems = "center";
                style.justifyContent = "center";
                style.overflow = "hidden";
            }

            return <div style={style}>{content}</div>;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const OpenEmbeddedDashboard = observer(
    class OpenEmbeddedDashboard extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get dashboardFilePath() {
            const widget = this.props.objects[0] as EmbeddedDashboardWidget;

            if (!widget.dashboard) {
                return undefined;
            }

            const filePath = evalConstantExpression(
                this.context.project,
                widget.dashboard
            ).value;

            if (!filePath) {
                return undefined;
            }

            const absoluteFilePath = this.context.getAbsoluteFilePath(filePath);

            if (isValidUrl(absoluteFilePath)) {
                return undefined;
            }

            return absoluteFilePath;
        }

        openDashboard = () => {
            const dashboardFilePath = this.dashboardFilePath;
            if (dashboardFilePath) {
                ipcRenderer.send("open-file", dashboardFilePath);
            }
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }

            if (!this.dashboardFilePath) {
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
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            }),
            makeExpressionProperty(
                {
                    name: "dashboard",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
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
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                hasExpressionProperties: true
            },
            makeStylePropertyInfo("style", "Default style", {
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            })
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
        }
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

    getDashboard(flowContext: IFlowContext) {
        const dashboard = getStringValue(flowContext, this, "dashboard", "");
        if (!dashboard) {
            return undefined;
        }

        if (isValidUrl(dashboard)) {
            return dashboard;
        }

        if (path.isAbsolute(dashboard)) {
            return dashboard;
        }

        return flowContext.projectStore.getAbsoluteFilePath(dashboard);
    }

    getDashboardInfo(flowContext: IFlowContext) {
        const dashboard = this.getDashboard(flowContext);
        if (dashboard) {
            if (isValidUrl(dashboard)) {
                return dashboard;
            }
            return path.basename(dashboard);
        }
        return "<not specified>";
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
