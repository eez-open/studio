import React from "react";
import { observable, makeObservable, action } from "mobx";

import { makeLazyComponent } from "eez-studio-ui/lazy-component";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType
} from "project-editor/core/object";

import {
    makeDataPropertyInfo,
    makeExpressionProperty,
    makeStylePropertyInfo,
    Widget
} from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { getAnyValue, getBooleanValue } from "project-editor/flow/helper";
import { Loader } from "eez-studio-ui/loader";
import { TERMINAL_WIDGET_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const InstrumentTerminalElement = makeLazyComponent(
    async () => {
        const { instruments } = await import("instrument/instrument-object");
        const { Terminal } = await import(
            "instrument/window/terminal/terminal"
        );

        const showLoader = observable.box<boolean>(true);
        setTimeout(
            action(() => {
                showLoader.set(false);
            }),
            1000
        );

        return { instruments, Terminal, showLoader };
    },
    (
        { instruments, Terminal, showLoader },
        props: {
            widget: InstrumentTerminalWidget;
            flowContext: IFlowContext;
            width: number;
            height: number;
        }
    ) => {
        let style: React.CSSProperties = {
            display: "flex",
            height: "100%"
        };
        let content;

        if (props.flowContext.projectStore.runtime) {
            let instrument = getAnyValue(
                props.flowContext,
                props.widget,
                "instrument",
                undefined
            );

            if (instrument) {
                const instrumentObject = instruments.get(instrument.id);

                if (instrumentObject) {
                    const appStore = instrumentObject.getEditor();
                    appStore.onCreate();

                    const showConnectionStatusBar = getBooleanValue(
                        props.flowContext,
                        props.widget,
                        "showConnectionStatusBar",
                        false
                    );

                    const showShortcuts = getBooleanValue(
                        props.flowContext,
                        props.widget,
                        "showShortcuts",
                        false
                    );

                    const showHelp = getBooleanValue(
                        props.flowContext,
                        props.widget,
                        "showHelp",
                        false
                    );

                    const showSideBar = getBooleanValue(
                        props.flowContext,
                        props.widget,
                        "showSideBar",
                        false
                    );

                    content = (
                        <Terminal
                            appStore={instrumentObject.getEditor()}
                            showConnectionStatusBar={showConnectionStatusBar}
                            showShortcuts={showShortcuts}
                            showHelp={showHelp}
                            showSideBar={showSideBar}
                        />
                    );
                } else {
                    content = showLoader.get() ? (
                        <Loader />
                    ) : (
                        "Instrument not found"
                    );
                }
            } else {
                content = showLoader.get() ? <Loader /> : "No instrument";
                style.alignItems = "center";
                style.justifyContent = "center";
            }
        } else {
            content = (
                <>
                    <p>Terminal for:</p>
                    <pre>{props.widget.instrument}</pre>
                </>
            );
            style.flexDirection = "column";
            style.alignItems = "center";
            style.justifyContent = "center";
        }

        return <div style={style}>{content}</div>;
    }
);

export class InstrumentTerminalWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Instrument",

        properties: [
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            }),
            makeExpressionProperty(
                {
                    name: "instrument",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:Instrument"
            ),
            makeExpressionProperty(
                {
                    name: "showConnectionStatusBar",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "boolean"
            ),
            makeExpressionProperty(
                {
                    name: "showShortcuts",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "boolean"
            ),
            makeExpressionProperty(
                {
                    name: "showHelp",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "boolean"
            ),
            makeExpressionProperty(
                {
                    name: "showSideBar",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "boolean"
            ),
            makeStylePropertyInfo("style", "Default style", {
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            })
        ],
        defaultValue: {
            left: 0,
            top: 0,
            width: 430,
            height: 560,
            showConnectionStatusBar: "true",
            showShortcuts: "true",
            showHelp: "true",
            showSideBar: "true"
        },

        icon: TERMINAL_WIDGET_ICON
    });

    instrument: string;
    showConnectionStatusBar: boolean;
    showShortcuts: boolean;
    showHelp: boolean;
    showSideBar: boolean;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            instrument: observable,
            showConnectionStatusBar: observable,
            showShortcuts: observable,
            showHelp: observable,
            showSideBar: observable
        });
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <InstrumentTerminalElement
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

registerClass("InstrumentTerminalWidget", InstrumentTerminalWidget);
