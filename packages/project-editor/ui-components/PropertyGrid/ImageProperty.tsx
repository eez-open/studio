import fs from "fs";
import { clipboard, nativeImage } from "@electron/remote";
import React from "react";
import { observer } from "mobx-react";
import { makeObservable, observable, runInAction } from "mobx";
import { dialog } from "@electron/remote";

import type { PropertyProps } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { Icon } from "eez-studio-ui/icon";

export const ImageProperty = observer(
    class ImageProperty extends React.Component<
        PropertyProps & { value: any; changeValue: (newValue: any) => void }
    > {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                hasClipboardImage: observable
            });
        }

        interval: any;
        hasClipboardImage: boolean;

        componentDidMount(): void {
            this.interval = setInterval(() => {
                runInAction(() => {
                    this.hasClipboardImage =
                        clipboard
                            .availableFormats()
                            .find(format => format.indexOf("image/") != -1) !=
                        undefined;
                });
            }, 100);
        }

        componentWillUnmount(): void {
            clearInterval(this.interval);
        }

        render() {
            const { propertyInfo, readOnly, value, changeValue } = this.props;

            const imageValue = value || "";
            const embeddedImage = imageValue.startsWith("data:image");

            return (
                <div>
                    <div className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            value={
                                embeddedImage ? "<embedded image>" : imageValue
                            }
                            readOnly
                        />
                        {embeddedImage && (
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={() => {
                                    clipboard.writeImage(
                                        nativeImage.createFromDataURL(
                                            imageValue
                                        )
                                    );
                                }}
                            >
                                <Icon icon="material:content_copy" size={16} />
                            </button>
                        )}
                        {this.hasClipboardImage && (
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={() => {
                                    changeValue(
                                        clipboard.readImage().toDataURL()
                                    );
                                }}
                            >
                                <Icon icon="material:content_paste" size={16} />
                            </button>
                        )}
                        {!readOnly && (
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={async () => {
                                    const result = await dialog.showOpenDialog({
                                        properties: ["openFile"],
                                        filters: [
                                            {
                                                name: "Image files",
                                                extensions: [
                                                    "png",
                                                    "jpg",
                                                    "jpeg"
                                                ]
                                            },
                                            {
                                                name: "All Files",
                                                extensions: ["*"]
                                            }
                                        ],
                                        defaultPath:
                                            propertyInfo.defaultImagesPath
                                                ? propertyInfo.defaultImagesPath(
                                                      this.context
                                                  )
                                                : undefined
                                    });
                                    const filePaths = result.filePaths;
                                    if (filePaths && filePaths[0]) {
                                        if (
                                            propertyInfo.embeddedImage == true
                                        ) {
                                            fs.readFile(
                                                this.context.getAbsoluteFilePath(
                                                    filePaths[0]
                                                ),
                                                "base64",
                                                (err: any, data: any) => {
                                                    if (!err) {
                                                        changeValue(
                                                            "data:image/png;base64," +
                                                                data
                                                        );
                                                    }
                                                }
                                            );
                                        } else {
                                            changeValue(
                                                this.context.getFilePathRelativeToProjectPath(
                                                    filePaths[0]
                                                )
                                            );
                                        }
                                    }
                                }}
                            >
                                &hellip;
                            </button>
                        )}
                        {imageValue && (
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={() => {
                                    changeValue(undefined);
                                }}
                            >
                                <Icon icon="material:close" size={16} />
                            </button>
                        )}
                    </div>
                    {imageValue &&
                        !this.props.propertyInfo.disableBitmapPreview && (
                            <img
                                src={
                                    imageValue &&
                                    imageValue.startsWith("data:image/")
                                        ? imageValue
                                        : this.context.getAbsoluteFilePath(
                                              imageValue || ""
                                          )
                                }
                                style={{
                                    display: "block",
                                    maxWidth: "100%",
                                    margin: "auto",
                                    paddingTop: "5px"
                                }}
                            />
                        )}
                </div>
            );
        }
    }
);
