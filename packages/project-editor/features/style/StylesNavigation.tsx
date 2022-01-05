import React from "react";
import { computed, IObservableValue } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { LayoutModels } from "project-editor/core/store";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { Style } from "./style";
import { drawText } from "project-editor/flow/editor/draw";

////////////////////////////////////////////////////////////////////////////////

@observer
export class StylesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get navigationObject() {
        return this.props.navigationObject;
    }

    @computed
    get style() {
        const navigationStore = this.context.navigationStore;

        if (navigationStore.selectedPanel) {
            if (navigationStore.selectedPanel.selectedObject instanceof Style) {
                return navigationStore.selectedPanel.selectedObject;
            }
        }

        return navigationStore.selectedStyleObject.get() as Style;
    }

    factory = (node: FlexLayout.TabNode) => {
        var component = node.getComponent();

        if (component === "styles") {
            return (
                <ListNavigation
                    id={this.props.id}
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

@observer
class StyleEditor extends React.Component<{
    width: number;
    height: number;
    text: string;
    style: IObservableValue<Style | undefined>;
}> {
    render() {
        const { width, height, text } = this.props;

        const style = this.props.style.get();
        if (!style) {
            return null;
        }

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
