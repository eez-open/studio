import fs from "fs";
import path from "path";
import { computed, observable, action, makeObservable } from "mobx";

import * as notification from "eez-studio-ui/notification";

import {
    ClassInfo,
    IEezObject,
    EezObject,
    registerClass,
    PropertyType,
    MessageType
} from "project-editor/core/object";
import { validators } from "eez-studio-shared/validation";

import {
    createObject,
    getProjectEditorStore,
    getUniquePropertyValue,
    Message,
    ProjectEditorStore
} from "project-editor/store";

import { findStyle } from "project-editor/features/style/style";
import { getThemedColor } from "project-editor/features/style/theme";

import { showGenericDialog } from "project-editor/core/util";

import { AbsoluteFileInput } from "project-editor/ui-components/FileInput";
import { getProject, Project } from "project-editor/project/project";

import { metrics } from "project-editor/features/bitmap/metrics";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import {
    BitmapColorFormat,
    isLVGLProject
} from "project-editor/project/project-type-traits";
import { copyFile, makeFolder } from "eez-studio-shared/util-electron";
import { IFieldProperties } from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

export class Bitmap extends EezObject {
    id: number | undefined;
    name: string;
    description?: string;
    image: string;
    bpp: number;
    alwaysBuild: boolean;
    style?: string;

    constructor() {
        super();

        makeObservable<Bitmap, "_imageElement">(this, {
            id: observable,
            name: observable,
            description: observable,
            image: observable,
            bpp: observable,
            alwaysBuild: observable,
            style: observable,
            _imageElement: observable,
            backgroundColor: computed,
            imageElement: computed({ keepAlive: true }),
            bitmapData: computed({ keepAlive: true })
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup,
                hideInPropertyGrid: isLVGLProject
            },
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
                defaultImagesPath: (projectEditorStore: ProjectEditorStore) =>
                    projectEditorStore.project.settings.general.assetsFolder
                        ? projectEditorStore.getAbsoluteFilePath(
                              projectEditorStore.project.settings.general
                                  .assetsFolder
                          )
                        : undefined
            },
            {
                name: "bpp",
                displayName: "Bits per pixel",
                type: PropertyType.Enum,
                enumItems: (bitmap: Bitmap) =>
                    isLVGLProject(bitmap)
                        ? [{ id: 24 }, { id: 32 }]
                        : [{ id: 16 }, { id: 32 }],
                defaultValue: 16,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "styles",
                hideInPropertyGrid: isLVGLProject
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean,
                hideInPropertyGrid: isLVGLProject
            }
        ],
        check: (bitmap: Bitmap) => {
            let messages: Message[] = [];

            const projectEditorStore = getProjectEditorStore(bitmap);

            ProjectEditor.checkAssetId(
                projectEditorStore,
                "bitmaps",
                bitmap,
                messages
            );

            return messages;
        },
        newItem: async (parent: IEezObject) => {
            const projectEditorStore = getProjectEditorStore(parent);

            const result = await showGenericDialog(projectEditorStore, {
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
                            type: AbsoluteFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    {
                                        name: "Image files",
                                        extensions: ["png", "jpg", "jpeg"]
                                    },
                                    { name: "All Files", extensions: ["*"] }
                                ]
                            }
                        },
                        ...(projectEditorStore.projectTypeTraits.isLVGL
                            ? []
                            : [
                                  {
                                      name: "bpp",
                                      displayName: "Bits per pixel",
                                      type: "enum",
                                      enumItems: [16, 32]
                                  } as IFieldProperties
                              ])
                    ]
                },
                values: {
                    bpp: 32
                }
            });

            return createBitmap(
                projectEditorStore,
                result.values.imageFilePath,
                undefined,
                projectEditorStore.projectTypeTraits.isLVGL
                    ? undefined
                    : result.values.bpp
            );
        },
        icon: "image"
    };

    private _imageElement: HTMLImageElement | null | undefined = undefined;
    private _imageElementImage: string;

    get backgroundColor() {
        if (this.bpp !== 32) {
            const style = findStyle(
                ProjectEditor.getProject(this),
                this.style || "default"
            );
            if (style && style.backgroundColorProperty) {
                return getThemedColor(
                    getProjectEditorStore(this),
                    style.backgroundColorProperty
                );
            }
        }
        return "transparent";
    }

    get imageSrc() {
        if (!this.image) {
            return "";
        }

        if (this.image.startsWith("data:image/")) {
            return this.image;
        }

        return ProjectEditor.getProject(
            this
        )._DocumentStore.getAbsoluteFilePath(this.image);
    }

    get imageElement() {
        if (!this.image) {
            return null;
        }

        if (!this._imageElement || this.image !== this._imageElementImage) {
            let imageElement = new Image();
            imageElement.src = this.imageSrc;

            imageElement.onload = action(() => {
                this._imageElement = imageElement;
                this._imageElementImage = this.image;
            });

            imageElement.onerror = action(() => {
                this._imageElement = null;
                this._imageElementImage = this.image;
            });

            return undefined;
        }

        return this._imageElement;
    }

    get bitmapData() {
        const image = this.imageElement;
        if (!(image instanceof HTMLImageElement)) {
            return image;
        }

        let canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;

        let ctx = canvas.getContext("2d");
        if (ctx == null) {
            return undefined;
        }

        if (this.backgroundColor !== "transparent") {
            ctx.fillStyle = this.backgroundColor;
            ctx.fillRect(0, 0, image.width, image.height);
        } else {
            ctx.clearRect(0, 0, image.width, image.height);
        }

        ctx.drawImage(image, 0, 0);

        let imageData = ctx.getImageData(0, 0, image.width, image.height).data;

        let pixels = new Uint8Array(
            (this.bpp === 32 ? 4 : this.bpp === 24 ? 3 : 2) *
                image.width *
                image.height
        );

        const rgb =
            getProject(this).projectTypeTraits.bitmapColorFormat ==
            BitmapColorFormat.RGB;

        for (let i = 0; i < 4 * image.width * image.height; i += 4) {
            let r = imageData[i];
            let g = imageData[i + 1];
            let b = imageData[i + 2];

            if (this.bpp === 32) {
                if (rgb) {
                    let a = imageData[i + 3];
                    pixels[i] = r;
                    pixels[i + 1] = g;
                    pixels[i + 2] = b;
                    pixels[i + 3] = a;
                } else {
                    let a = imageData[i + 3];
                    pixels[i] = b;
                    pixels[i + 1] = g;
                    pixels[i + 2] = r;
                    pixels[i + 3] = a;
                }
            } else if (this.bpp == 24) {
                if (rgb) {
                    pixels[i] = r;
                    pixels[i + 1] = g;
                    pixels[i + 2] = b;
                } else {
                    pixels[i] = b;
                    pixels[i + 1] = g;
                    pixels[i + 2] = r;
                }
            } else {
                // rrrrrggggggbbbbb
                pixels[i / 2] = ((g & 28) << 3) | (b >> 3);
                pixels[i / 2 + 1] = (r & 248) | (g >> 5);
            }
        }

        return {
            width: image.width,
            height: image.height,
            bpp: this.bpp,
            pixels: pixels
        };
    }
}

registerClass("Bitmap", Bitmap);

export async function createBitmap(
    projectEditorStore: ProjectEditorStore,
    filePath: string,
    fileType?: string,
    bpp?: number
) {
    if (fileType == undefined) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext == ".jpg" || ext == ".jpeg") {
            fileType = "image/jpg";
        } else {
            fileType = "image/png";
        }
    }

    if (bpp == undefined) {
        if (fileType == "image/jpg") {
            bpp = 32; // 24
        } else {
            bpp = 32;
        }
    }

    console.log("createBitmap", filePath, fileType, bpp);

    try {
        if (projectEditorStore.project.settings.general.assetsFolder) {
            const assetsFolder = projectEditorStore.getAbsoluteFilePath(
                projectEditorStore.project.settings.general.assetsFolder
            );
            await makeFolder(assetsFolder);

            let relativePath = path
                .relative(assetsFolder, filePath)
                .replace(/\\/g, "/");

            if (relativePath.startsWith("..")) {
                relativePath = path.basename(filePath);
                copyFile(filePath, assetsFolder + "/" + relativePath);
            }

            const bitmapProperties: Partial<Bitmap> = {
                name: getUniquePropertyValue(
                    projectEditorStore.project.bitmaps,
                    "name",
                    path.parse(filePath).name
                ) as string,
                image:
                    projectEditorStore.project.settings.general.assetsFolder +
                    "/" +
                    relativePath,
                bpp,
                alwaysBuild: false
            };

            const bitmap = createObject<Bitmap>(
                projectEditorStore,
                bitmapProperties,
                Bitmap
            );

            return bitmap;
        } else {
            const result = fs.readFileSync(filePath, "base64");

            const bitmapProperties: Partial<Bitmap> = {
                name: getUniquePropertyValue(
                    projectEditorStore.project.bitmaps,
                    "name",
                    path.parse(filePath).name
                ) as string,
                image: `data:${fileType};base64,` + result,
                bpp,
                alwaysBuild: false
            };

            const bitmap = createObject<Bitmap>(
                projectEditorStore,
                bitmapProperties,
                Bitmap
            );

            return bitmap;
        }
    } catch (err) {
        notification.error(err);
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface BitmapData {
    width: number;
    height: number;
    bpp: number;
    style?: string;
    pixels: Uint8Array;
}

export async function getBitmapData(bitmap: Bitmap): Promise<BitmapData> {
    while (true) {
        const bitmapData = bitmap.bitmapData;
        if (bitmapData) {
            return bitmapData;
        }
        if (bitmapData === null) {
            return {
                width: 1,
                height: 1,
                bpp: 32,
                pixels: new Uint8Array([0, 0, 0, 0])
            };
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
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
    displayName: "Bitmaps",
    mandatory: false,
    key: "bitmaps",
    type: PropertyType.Array,
    typeClass: Bitmap,
    icon: "image",
    create: () => [],
    check: (object: EezObject[]) => {
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
            !ProjectEditor.getProject(object).projectTypeTraits.isDashboard &&
            !ProjectEditor.getProject(object).projectTypeTraits.isLVGL &&
            !findStyle(getProjectEditorStore(object).project, "default")
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
};
