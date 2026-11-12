import React from "react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";

import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";

import { isObjectExists } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { Style } from "./style";
import * as eezGuiDraw from "project-editor/flow/editor/eez-gui-draw";
import { LVGLStylesNavigation } from "project-editor/lvgl/style";

import { StylesTreeNavigation } from "project-editor/features/style/StylesTreeNavigation";
import { isEezGuiEditorWasmProject } from "project-editor/flow/editor/eez-gui-editor-wasm-switch";
import { EezGuiStylePreview } from "project-editor/flow/editor/eez-gui-style-preview";
import type { Project } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export const StylesTab = observer(
    class StylesTab extends React.Component<{
        // render only this part (e.g. "styles", without the preview)
        component?: string;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {});
        }

        render() {
            return this.context.projectTypeTraits.isLVGL ? (
                <LVGLStylesNavigation component={this.props.component} />
            ) : (
                <StylesNavigation component={this.props.component} />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const StylesNavigation = observer(
    class StylesNavigation extends React.Component<{
        component?: string;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                navigationObject: computed
            });
        }

        get navigationObject() {
            return this.context.project.styles;
        }

        factory = (node: FlexLayout.TabNode) => {
            return this.renderComponent(node.getComponent());
        };

        renderComponent(component: string | undefined) {
            if (component === "styles") {
                return (
                    <StylesTreeNavigation
                        id={"styles"}
                        navigationObject={this.navigationObject}
                        selectedObject={
                            this.context.navigationStore.selectedStyleObject
                        }
                        masterNavigationObject={
                            this.context.project.masterProject?.styles
                        }
                    />
                );
            }

            if (component === "preview") {
                return <StyleEditor width={480} height={272} text="Hello!" />;
            }

            return null;
        }

        render() {
            if (this.props.component) {
                return this.renderComponent(this.props.component);
            }

            return (
                <FlexLayoutContainer
                    model={this.context.layoutModels.styles}
                    factory={this.factory}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function drawStylePreview(
    project: Project,
    canvas: HTMLCanvasElement,
    style: Style,
    text: string,
    inverse: boolean
) {
    let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (ctx) {
        ctx.save();

        eezGuiDraw.setProject(project);

        if (style.blinkProperty) {
            eezGuiDraw.drawText(
                ctx,
                text,
                0,
                0,
                canvas.width,
                canvas.height,
                style,
                inverse
            );
        } else {
            if (canvas.width > canvas.height) {
                eezGuiDraw.drawText(
                    ctx,
                    text,
                    0,
                    0,
                    canvas.width / 2 - 4,
                    canvas.height,
                    style,
                    false
                );
                eezGuiDraw.drawText(
                    ctx,
                    text,
                    canvas.width / 2 + 4,
                    0,
                    canvas.width / 2 - 4,
                    canvas.height,
                    style,
                    true
                );
            } else {
                eezGuiDraw.drawText(
                    ctx,
                    text,
                    0,
                    0,
                    canvas.width,
                    canvas.height / 2 - 4,
                    style,
                    false
                );
                eezGuiDraw.drawText(
                    ctx,
                    text,
                    0,
                    canvas.height / 2 + 4,
                    canvas.width,
                    canvas.height / 2 - 4,
                    style,
                    true
                );
            }
        }
        ctx.restore();
    }
}

////////////////////////////////////////////////////////////////////////////////

const StyleEditor = observer(
    class StyleEditor extends React.Component<{
        width: number;
        height: number;
        text: string;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        inverse: boolean = false;
        interval: any;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                inverse: observable
            });
        }

        componentDidMount(): void {
            this.interval = setInterval(
                action(() => {
                    this.inverse = !this.inverse;
                }),
                400
            );
        }

        componentWillUnmount(): void {
            if (this.interval) {
                clearInterval(this.interval);
            }
        }

        get style() {
            const navigationStore = this.context.navigationStore;

            const style = navigationStore.selectedStyleObject.get();
            if (!style) {
                return undefined;
            }

            if (!isObjectExists(style)) {
                return undefined;
            }

            if (style instanceof Style) {
                return style;
            }

            return undefined;
        }

        render() {
            const { width, height, text } = this.props;

            const style = this.style;
            if (!style) {
                return null;
            }

            if (this.context.projectTypeTraits.isDashboard) {
                return (
                    <div className="EezStudio_StylePreviewContainer">
                        <div
                            className={classNames(
                                "EezStudio_StylePreview",
                                style.classNames
                            )}
                        >
                            {text}
                        </div>
                    </div>
                );
            } else if (isEezGuiEditorWasmProject(this.context.project)) {
                return (
                    <EezGuiStylePreview
                        project={this.context.project}
                        style={style}
                        width={width}
                        height={height}
                        text={text}
                        inverse={style.blinkProperty ? this.inverse : false}
                    />
                );
            } else {
                let canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                drawStylePreview(this.context.project, canvas, style, text, this.inverse);

                return (
                    <img
                        className="EezStudio_StyleEditorImg"
                        src={canvas.toDataURL()}
                    />
                );
            }
        }
    }
);
