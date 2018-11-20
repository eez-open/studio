import { observable, action } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { ProjectStore } from "project-editor/core/store";
import { ClassInfo, EezObject, registerClass, PropertyType } from "project-editor/core/object";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

import { BitmapEditor } from "project-editor/project/features/gui/BitmapEditor";
import { getStyleProperty } from "project-editor/project/features/gui/style";

let fs = EEZStudio.electron.remote.require("fs");

export class Bitmap extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    image: string;
    @observable
    bpp: number;
    @observable
    style?: string;
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
                hideInPropertyGrid: true,
                skipSearch: true
            },
            {
                name: "bpp",
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
        newItem: (parent: EezObject) => {
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
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return new Promise<Bitmap>((resolve, reject) => {
                    fs.readFile(
                        ProjectStore.getAbsoluteFilePath(result.values.imageFilePath),
                        "base64",
                        (err: any, data: any) => {
                            if (err) {
                                reject(err);
                            } else {
                                let newBitmap: Bitmap = <any>{
                                    name: result.values.name,
                                    image: "data:image/png;base64," + data
                                };

                                resolve(newBitmap);
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

            let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");

            if (bitmap.bpp === 32) {
                ctx.clearRect(0, 0, image.width, image.height);
            } else {
                ctx.fillStyle = getStyleProperty(bitmap.style, "backgroundColor");
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
