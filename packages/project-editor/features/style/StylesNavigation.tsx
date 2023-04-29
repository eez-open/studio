import React from "react";
import { computed, IObservableValue, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";

import { LayoutModels } from "project-editor/store";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { ProjectContext } from "project-editor/project/context";
import { Style } from "./style";
import { drawText } from "project-editor/flow/editor/draw";
import { LVGLStylesNavigation } from "project-editor/lvgl/style";

////////////////////////////////////////////////////////////////////////////////

export const StylesTab = observer(
    class StylesTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {});
        }

        render() {
            return this.context.projectTypeTraits.isLVGL ? (
                <LVGLStylesNavigation />
            ) : (
                <StylesNavigation />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const StylesNavigation = observer(
    class StylesNavigation extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                navigationObject: computed,
                style: computed
            });
        }

        get navigationObject() {
            return this.context.project.styles;
        }

        get style() {
            const navigationStore = this.context.navigationStore;

            if (navigationStore.selectedPanel) {
                if (
                    navigationStore.selectedPanel.selectedObject instanceof
                    Style
                ) {
                    if (
                        navigationStore.selectedPanel.selectedObject instanceof
                        Style
                    ) {
                        return navigationStore.selectedPanel.selectedObject;
                    } else {
                        return undefined;
                    }
                }
            }

            if (navigationStore.selectedStyleObject.get() instanceof Style) {
                return navigationStore.selectedStyleObject.get();
            }

            return undefined;
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "styles") {
                return (
                    <ListNavigation
                        id={"styles"}
                        navigationObject={this.navigationObject}
                        selectedObject={
                            this.context.navigationStore.selectedStyleObject
                        }
                    />
                );
            }

            if (component === "preview") {
                return this.style ? (
                    <StyleEditor
                        style={
                            this.context.navigationStore
                                .selectedStyleObject as IObservableValue<
                                Style | undefined
                            >
                        }
                        width={480}
                        height={272}
                        text="Hello!"
                    />
                ) : (
                    <div />
                );
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.styles}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function drawStylePreview(
    canvas: HTMLCanvasElement,
    style: Style,
    text: string
) {
    let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (ctx) {
        ctx.save();
        if (canvas.width > canvas.height) {
            drawText(
                ctx,
                text,
                0,
                0,
                canvas.width / 2 - 4,
                canvas.height,
                style,
                false
            );
            drawText(
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
            drawText(
                ctx,
                text,
                0,
                0,
                canvas.width,
                canvas.height / 2 - 4,
                style,
                false
            );
            drawText(
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
        ctx.restore();
    }
}

////////////////////////////////////////////////////////////////////////////////

const StyleEditor = observer(
    class StyleEditor extends React.Component<{
        width: number;
        height: number;
        text: string;
        style: IObservableValue<Style | undefined>;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const { width, height, text } = this.props;

            const style = this.props.style.get();
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
            } else {
                let canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                drawStylePreview(canvas, style, text);

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
