import { computed, observable, action } from "mobx";
import React from "react";
import { observer } from "mobx-react";
import styled from "eez-studio-ui/styled-components";

import {
    ClassInfo,
    IEezObject,
    EezObject,
    registerClass,
    PropertyType,
    NavigationComponent
} from "project-editor/core/object";
import { NavigationStore } from "project-editor/core/store";
import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Splitter } from "eez-studio-ui/splitter";

import { findStyle } from "project-editor/features/gui/gui";
import { getThemedColor, ThemesSideView } from "project-editor/features/gui/theme";

import { ProjectStore } from "project-editor/core/store";
import { RelativeFileInput } from "project-editor/components/RelativeFileInput";
import { PropertiesPanel } from "project-editor/project/ProjectEditor";

////////////////////////////////////////////////////////////////////////////////

const BitmapEditorContainer = styled.div`
    flex-shrink: 1;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center; /* align horizontal */
    align-items: center; /* align vertical */
    max-height: 100%;

    & > img {
        background-color: transparent;
        max-width: 100%;
        max-height: calc(100% - 50px);
        margin-bottom: 25px;
    }
`;

@observer
class BitmapEditor extends React.Component<{ bitmap: Bitmap }> {
    render() {
        const bitmap = this.props.bitmap;

        if (!bitmap.imageElement) {
            return null;
        }

        return (
            <BitmapEditorContainer>
                <img src={bitmap.image} style={{ backgroundColor: bitmap.backgroundColor }} />
                <h4>
                    Dimension: {bitmap.imageElement.width} x {bitmap.imageElement.height}
                </h4>
            </BitmapEditorContainer>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class BitmapsNavigation extends NavigationComponent {
    @computed
    get bitmap() {
        if (NavigationStore.selectedPanel) {
            if (NavigationStore.selectedPanel.selectedObject instanceof Bitmap) {
                return NavigationStore.selectedPanel.selectedObject;
            }
        }

        if (NavigationStore.selectedObject instanceof Bitmap) {
            return NavigationStore.selectedObject;
        }

        return undefined;
    }

    render() {
        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/bitmaps`}
                sizes={`240px|100%|400px|240px`}
                childrenOverflow="hidden|hidden|hidden|hidden"
            >
                <ListNavigation id={this.props.id} navigationObject={this.props.navigationObject} />
                {this.bitmap ? <BitmapEditor bitmap={this.bitmap} /> : <div />}
                <PropertiesPanel object={this.bitmap} />
                <ThemesSideView />
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface IBitmap {
    name: string;
    description?: string;
    image: string;
    bpp: number;
    alwaysBuild: boolean;
    style?: string;
}

export class Bitmap extends EezObject implements IBitmap {
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
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean
            }
        ],
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Bitmap",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [validators.required, validators.unique({}, parent)]
                        },
                        {
                            name: "imageFilePath",
                            displayName: "Image",
                            type: RelativeFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    { name: "PNG Image files", extensions: ["png"] },
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
                return new Promise<IBitmap>((resolve, reject) => {
                    const fs = EEZStudio.electron.remote.require("fs");
                    fs.readFile(
                        ProjectStore.getAbsoluteFilePath(result.values.imageFilePath),
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

    @observable
    private _imageElement: HTMLImageElement | null = null;
    private _imageElementImage: string;

    @computed
    get backgroundColor() {
        if (this.bpp !== 32) {
            const style = findStyle(this.style || "default");
            if (style && style.backgroundColorProperty) {
                return getThemedColor(style.backgroundColorProperty);
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

registerClass(Bitmap);

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

            let imageData = ctx.getImageData(0, 0, image.width, image.height).data;

            let pixels = new Uint8Array((bitmap.bpp === 32 ? 4 : 2) * image.width * image.height);

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
