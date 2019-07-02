import { observable, action } from "mobx";
import React from "react";
import { observer } from "mobx-react";
import styled from "eez-studio-ui/styled-components";

import {
    EditorComponent,
    ClassInfo,
    EezObject,
    registerClass,
    PropertyType,
    asArray
} from "project-editor/model/object";
import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { getPageContext } from "project-editor/project/features/gui/page-editor/page-context";

import { ProjectStore } from "project-editor/core/store";
import { RelativeFileInput } from "project-editor/components/RelativeFileInput";
import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

let fs = EEZStudio.electron.remote.require("fs");

////////////////////////////////////////////////////////////////////////////////

const BitmapEditorContainer = styled.div`
    flex-grow: 1;
    display: flex;
    justify-content: center; /* align horizontal */
    align-items: center; /* align vertical */
`;

@observer
class BitmapEditor extends EditorComponent {
    render() {
        const bitmap = this.props.editor.object as Bitmap;

        const style = {
            backgroundColor:
                bitmap.bpp === 32
                    ? "transparent"
                    : getPageContext().getThemedColor(bitmap.backgroundColor),
            width: "100%"
        };

        return (
            <BitmapEditorContainer>
                <div>
                    <div>
                        <img src={bitmap.image} style={style} />
                    </div>
                    {bitmap.imageElement && (
                        <h4>
                            Dimension: {bitmap.imageElement.width} x {bitmap.imageElement.height}
                        </h4>
                    )}
                </div>
            </BitmapEditorContainer>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IBitmap {
    name: string;
    image: string;
}

export class Bitmap extends EezObject implements IBitmap {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    image: string;
    @observable
    bpp: number;
    @observable
    backgroundColor?: string;
    @observable
    alwaysBuild: boolean;

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
                type: PropertyType.Enum,
                enumItems: [{ id: 16 }, { id: 32 }],
                defaultValue: 16
            },
            {
                name: "backgroundColor",
                type: PropertyType.ThemedColor,
                referencedObjectCollectionPath: ["gui", "colors"]
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Bitmap",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
                            ]
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
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return new Promise<IBitmap>((resolve, reject) => {
                    fs.readFile(
                        ProjectStore.getAbsoluteFilePath(result.values.imageFilePath),
                        "base64",
                        (err: any, data: any) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({
                                    name: result.values.name,
                                    image: "data:image/png;base64,"
                                });
                            }
                        }
                    );
                });
            });
        },
        editorComponent: BitmapEditor,
        navigationComponent: ListNavigationWithContent,
        navigationComponentId: "bitmaps",
        icon: "image"
    };

    private _imageElementLoading: boolean = false;
    @observable
    private _imageElement: HTMLImageElement | null = null;

    get imageElement() {
        if (!this._imageElement && !this._imageElementLoading) {
            this._imageElementLoading = true;
            let imageElement = new Image();
            imageElement.src = this.image;
            imageElement.onload = action(() => {
                this._imageElement = imageElement;
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
    pixels: number[];
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

            if (bitmap.bpp === 32) {
                ctx.clearRect(0, 0, image.width, image.height);
            } else {
                ctx.fillStyle = bitmap.backgroundColor
                    ? getPageContext().getThemedColor(bitmap.backgroundColor)
                    : "transparent";
                ctx.fillRect(0, 0, image.width, image.height);
            }

            ctx.drawImage(image, 0, 0);

            let imageData = ctx.getImageData(0, 0, image.width, image.height).data;

            let pixels: number[] = [];
            for (let i = 0; i < 4 * image.width * image.height; i += 4) {
                let r = imageData[i];
                let g = imageData[i + 1];
                let b = imageData[i + 2];

                if (bitmap.bpp === 32) {
                    let a = imageData[i + 3];
                    pixels.push(b);
                    pixels.push(g);
                    pixels.push(r);
                    pixels.push(a);
                } else {
                    // rrrrrggggggbbbbb
                    pixels.push(((g & 28) << 3) | (b >> 3));
                    pixels.push((r & 248) | (g >> 5));
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
