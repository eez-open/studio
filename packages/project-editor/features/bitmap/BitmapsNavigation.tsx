import { computed } from "mobx";
import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { LayoutModel } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { Bitmap } from "./bitmap";

////////////////////////////////////////////////////////////////////////////////

@observer
export class BitmapsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get bitmap() {
        if (this.context.navigationStore.selectedPanel) {
            if (
                this.context.navigationStore.selectedPanel
                    .selectedObject instanceof Bitmap
            ) {
                return this.context.navigationStore.selectedPanel
                    .selectedObject;
            }
        }

        return this.context.navigationStore.selectedBitmapObject.get() as Bitmap;
    }

    get model() {
        return FlexLayout.Model.fromJson({
            global: LayoutModel.GLOBAL_OPTIONS,
            borders: [],
            layout: {
                type: "row",
                children: [
                    {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                weight: 75,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Bitmaps",
                                        component: "bitmaps"
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 25,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Preview",
                                        component: "preview"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        });
    }

    factory = (node: FlexLayout.TabNode) => {
        var component = node.getComponent();

        if (component === "bitmaps") {
            return (
                <ListNavigation
                    id={this.props.id}
                    navigationObject={this.props.navigationObject}
                    selectedObject={
                        this.context.navigationStore.selectedBitmapObject
                    }
                />
            );
        }

        if (component === "preview") {
            return <BitmapEditor />;
        }

        return null;
    };

    render() {
        return (
            <FlexLayout.Layout
                model={this.model}
                factory={this.factory}
                realtimeResize={true}
                font={LayoutModel.FONT_SUB}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class BitmapEditor extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        const bitmap =
            this.context.navigationStore.selectedBitmapObject.get() as Bitmap;

        if (!bitmap || !bitmap.imageElement) {
            return null;
        }

        return (
            <div className="EezStudio_BitmapEditorContainer">
                <img
                    src={bitmap.image}
                    style={{ backgroundColor: bitmap.backgroundColor }}
                />
                <h4>
                    Dimension: {bitmap.imageElement.width} x{" "}
                    {bitmap.imageElement.height}
                </h4>
            </div>
        );
    }
}
