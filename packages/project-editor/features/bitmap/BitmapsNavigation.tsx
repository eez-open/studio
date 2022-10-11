import fs from "fs";
import path from "path";
import { computed, makeObservable } from "mobx";
import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import {
    createObject,
    getUniquePropertyValue,
    LayoutModels
} from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { Bitmap } from "./bitmap";

////////////////////////////////////////////////////////////////////////////////

export const BitmapsNavigation = observer(
    class BitmapsNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                bitmap: computed
            });
        }

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
                        onFilesDrop={files => {
                            this.context.undoManager.setCombineCommands(true);

                            for (const file of files) {
                                if (file.type.startsWith("image/")) {
                                    try {
                                        const result = fs.readFileSync(
                                            file.path,
                                            "base64"
                                        );

                                        const bitmapProperties: Partial<Bitmap> =
                                            {
                                                name: getUniquePropertyValue(
                                                    this.context.project
                                                        .bitmaps,
                                                    "name",
                                                    path.parse(file.path).name
                                                ) as string,
                                                image:
                                                    `data:${file.type};base64,` +
                                                    result,
                                                bpp: 32,
                                                alwaysBuild: false
                                            };

                                        const bitmap = createObject<Bitmap>(
                                            this.context,
                                            bitmapProperties,
                                            Bitmap
                                        );

                                        this.context.addObject(
                                            this.context.project.bitmaps,
                                            bitmap
                                        );
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }
                            }

                            this.context.undoManager.setCombineCommands(false);
                        }}
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
                    model={this.context.layoutModels.bitmaps}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const BitmapEditor = observer(
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
);
