import { computed, makeObservable } from "mobx";
import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { isObjectExists } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { Bitmap, createBitmapFromFile } from "./bitmap";

////////////////////////////////////////////////////////////////////////////////

export const BitmapsTab = observer(
    class BitmapsTab extends React.Component<{
        // render only this part (e.g. "bitmaps", without the preview)
        component?: string;
    }> {
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
            return this.renderComponent(node.getComponent());
        };

        renderComponent(component: string | undefined) {
            if (component === "bitmaps") {
                return (
                    <ListNavigation
                        id={"bitmaps"}
                        navigationObject={this.context.project.bitmaps}
                        selectedObject={
                            this.context.navigationStore.selectedBitmapObject
                        }
                        masterNavigationObject={
                            this.context.project.masterProject?.bitmaps
                        }
                        onFilesDrop={async (files, filePaths) => {
                            this.context.undoManager.setCombineCommands(true);

                            for (let i = 0; i < files.length; i++) {
                                const file = files[i];
                                if (file.type.startsWith("image/")) {
                                    const bitmap = await createBitmapFromFile(
                                        this.context,
                                        file,
                                        filePaths[i]
                                    );
                                    if (bitmap) {
                                        this.context.addObject(
                                            this.context.project.bitmaps,
                                            bitmap
                                        );
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
        }

        render() {
            if (this.props.component) {
                return this.renderComponent(this.props.component);
            }

            return (
                <FlexLayoutContainer
                    model={this.context.layoutModels.bitmaps}
                    factory={this.factory}
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

            if (!bitmap || !isObjectExists(bitmap) || !bitmap.imageElement) {
                return null;
            }

            return (
                <div
                    className="EezStudio_BitmapEditorContainer"
                    style={{ padding: 10 }}
                >
                    <div style={{ marginBottom: 10 }}>
                        Dimension: {bitmap.imageElement.width} x{" "}
                        {bitmap.imageElement.height} px
                    </div>
                    <div>
                        <img
                            src={bitmap.imageSrc}
                            style={{
                                backgroundColor: bitmap.backgroundColor
                            }}
                        />
                    </div>
                </div>
            );
        }
    }
);
