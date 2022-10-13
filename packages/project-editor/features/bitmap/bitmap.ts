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

import { RelativeFileInput } from "project-editor/ui-components/FileInput";
import { getProject, Project } from "project-editor/project/project";

import { metrics } from "project-editor/features/bitmap/metrics";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import {
    BitmapColorFormat,
    isLVGLProject
} from "project-editor/project/project-type-traits";
import { copyFile, makeFolder } from "eez-studio-shared/util-electron";

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
            imageElement: computed
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup
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
                enumItems: [{ id: 16 }, { id: 32 }],
                defaultValue: 16
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "styles",
                hideInPropertyGrid: isLVGLProject
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean
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
                            type: RelativeFileInput,
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
            });

            return createBitmap(
                projectEditorStore,
                result.values.imageFilePath,
                "image/png",
                result.values.bpp
            );
        },
        icon: "image"
    };

    private _imageElement: HTMLImageElement | null = null;
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

        if (this.image !== this._imageElementImage) {
            let imageElement = new Image();
            imageElement.src = this.imageSrc;

            imageElement.onload = action(() => {
                this._imageElement = imageElement;
                this._imageElementImage = this.image;
            });
        }

        return this._imageElement;
    }
}

registerClass("Bitmap", Bitmap);

export async function createBitmap(
    projectEditorStore: ProjectEditorStore,
    filePath: string,
    fileType: string,
    bpp?: number
) {
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
                bpp: bpp ?? 32,
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
                bpp: bpp ?? 32,
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

export function getBitmapData(bitmap: Bitmap): Promise<BitmapData> {
    return new Promise((resolve, reject) => {
        let image = new Image();

        image.src = bitmap.imageSrc;

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

            const rgb =
                getProject(bitmap).projectTypeTraits.bitmapColorFormat ==
                BitmapColorFormat.RGB;

            for (let i = 0; i < 4 * image.width * image.height; i += 4) {
                let r = imageData[i];
                let g = imageData[i + 1];
                let b = imageData[i + 2];

                if (bitmap.bpp === 32) {
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
