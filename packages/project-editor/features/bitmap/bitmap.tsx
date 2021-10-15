import { computed, observable, action } from "mobx";
import React from "react";
import { observer } from "mobx-react";

import {
    ClassInfo,
    IEezObject,
    EezObject,
    registerClass,
    PropertyType,
    NavigationComponent,
    MessageType
} from "project-editor/core/object";
import { validators } from "eez-studio-shared/validation";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Splitter } from "eez-studio-ui/splitter";

import { getDocumentStore, Message } from "project-editor/core/store";

import { findStyle } from "project-editor/features/style/style";
import { getThemedColor } from "project-editor/features/style/theme";

import { showGenericDialog } from "project-editor/core/util";

import { ProjectContext } from "project-editor/project/context";
import { RelativeFileInput } from "project-editor/components/RelativeFileInput";
import { PropertiesPanel } from "project-editor/project/PropertiesPanel";
import type { Project } from "project-editor/project/project";

import { metrics } from "project-editor/features/bitmap/metrics";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

@observer
class BitmapEditor extends React.Component<{ bitmap: Bitmap }> {
    render() {
        const bitmap = this.props.bitmap;

        if (!bitmap.imageElement) {
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

        if (this.context.navigationStore.selectedObject instanceof Bitmap) {
            return this.context.navigationStore.selectedObject;
        }

        return undefined;
    }

    render() {
        return (
            <Splitter
                type="horizontal"
                persistId={"project-editor/bitmaps"}
                sizes={"240px|100%|400px"}
                childrenOverflow={"hidden|hidden|hidden"}
            >
                <ListNavigation
                    id={this.props.id}
                    navigationObject={this.props.navigationObject}
                />
                {this.bitmap ? <BitmapEditor bitmap={this.bitmap} /> : <div />}
                <PropertiesPanel object={this.bitmap} />
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Bitmap extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable image: string;
    @observable bpp: number;
    @observable alwaysBuild: boolean;
    @observable style?: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "image",
                type: PropertyType.Image,
                skipSearch: true,
                embeddedImage: true
            },
            {
                name: "bpp",
                displayName: "Bits per pixel",
                type: PropertyType.Enum,
                enumItems: [{ id: 16 }, { id: 32 }],
                defaultValue: 16
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "styles"
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean
            }
        ],
        newItem: (parent: IEezObject) => {
            const DocumentStore = getDocumentStore(parent);

            return showGenericDialog(DocumentStore, {
                dialogDefinition: {
                    title: "New Bitmap",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "imageFilePath",
                            displayName: "Image",
                            type: RelativeFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    {
                                        name: "PNG Image files",
                                        extensions: ["png"]
                                    },
                                    { name: "All Files", extensions: ["*"] }
                                ]
                            }
                        },
                        {
                            name: "bpp",
                            displayName: "Bits per pixel",
                            type: "enum",
                            enumItems: [16, 32]
                        }
                    ]
                },
                values: {
                    bpp: 32
                }
            }).then(result => {
                return new Promise((resolve, reject) => {
                    const fs = EEZStudio.remote.require("fs");
                    fs.readFile(
                        getDocumentStore(parent).getAbsoluteFilePath(
                            result.values.imageFilePath
                        ),
                        "base64",
                        (err: any, data: any) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({
                                    name: result.values.name,
                                    image: "data:image/png;base64," + data,
                                    bpp: result.values.bpp,
                                    alwaysBuild: false
                                });
                            }
                        }
                    );
                });
            });
        },
        navigationComponent: BitmapsNavigation,
        navigationComponentId: "bitmaps",
        icon: "image"
    };

    @observable private _imageElement: HTMLImageElement | null = null;
    private _imageElementImage: string;

    @computed
    get backgroundColor() {
        if (this.bpp !== 32) {
            const style = findStyle(
                ProjectEditor.getProject(this),
                this.style || "default"
            );
            if (style && style.backgroundColorProperty) {
                return getThemedColor(
                    getDocumentStore(this),
                    style.backgroundColorProperty
                );
            }
        }
        return "transparent";
    }

    @computed
    get imageElement() {
        if (!this.image) {
            return null;
        }

        if (this.image !== this._imageElementImage) {
            let imageElement = new Image();
            imageElement.src = this.image;

            imageElement.onload = action(() => {
                this._imageElement = imageElement;
                this._imageElementImage = this.image;
            });
        }

        return this._imageElement;
    }
}

registerClass("Bitmap", Bitmap);

////////////////////////////////////////////////////////////////////////////////

export interface BitmapData {
    width: number;
    height: number;
    bpp: number;
    style?: string;
    pixels: Uint8Array;
}

export function getData(bitmap: Bitmap): Promise<BitmapData> {
    return new Promise((resolve, reject) => {
        let image = new Image();

        image.src = bitmap.image;

        image.onload = () => {
            let canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;

            let ctx = canvas.getContext("2d");
            if (ctx == null) {
                reject();
                return;
            }

            if (bitmap.backgroundColor !== "transparent") {
                ctx.fillStyle = bitmap.backgroundColor;
                ctx.fillRect(0, 0, image.width, image.height);
            } else {
                ctx.clearRect(0, 0, image.width, image.height);
            }

            ctx.drawImage(image, 0, 0);

            let imageData = ctx.getImageData(
                0,
                0,
                image.width,
                image.height
            ).data;

            let pixels = new Uint8Array(
                (bitmap.bpp === 32 ? 4 : 2) * image.width * image.height
            );

            for (let i = 0; i < 4 * image.width * image.height; i += 4) {
                let r = imageData[i];
                let g = imageData[i + 1];
                let b = imageData[i + 2];

                if (bitmap.bpp === 32) {
                    let a = imageData[i + 3];
                    pixels[i] = b;
                    pixels[i + 1] = g;
                    pixels[i + 2] = r;
                    pixels[i + 3] = a;
                } else {
                    // rrrrrggggggbbbbb
                    pixels[i / 2] = ((g & 28) << 3) | (b >> 3);
                    pixels[i / 2 + 1] = (r & 248) | (g >> 5);
                }
            }

            resolve({
                width: image.width,
                height: image.height,
                bpp: bitmap.bpp,
                pixels: pixels
            });
        };

        image.onerror = () => {
            reject();
        };
    });
}

////////////////////////////////////////////////////////////////////////////////

export function findBitmap(project: Project, bitmapName: any) {
    return ProjectEditor.documentSearch.findReferencedObject(
        project,
        "bitmaps",
        bitmapName
    ) as Bitmap | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-bitmap",
    version: "0.1.0",
    description: "Bitmpas support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Bitmaps",
        category: "project-feature",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "bitmaps",
                type: PropertyType.Array,
                typeClass: Bitmap,
                icon: "image",
                create: () => [],
                check: (object: IEezObject[]) => {
                    let messages: Message[] = [];

                    if (object.length > 255) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                "Max. 255 bitmaps are supported",
                                object
                            )
                        );
                    }

                    if (
                        !findStyle(getDocumentStore(object).project, "default")
                    ) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                "'Default' style is missing.",
                                object
                            )
                        );
                    }

                    return messages;
                },
                metrics
            }
        }
    }
};
