import React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import {
    getFileName,
    getValidFileNameFromFileName,
    getShortFileName,
    fileExists,
    isValidFileName,
    isValidPath
} from "eez-studio-shared/util-electron";

import { makeValidator, validators } from "eez-studio-shared/validation";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import {
    PropertyList,
    TextInputProperty,
    NumberInputProperty,
    BooleanProperty
} from "eez-studio-ui/properties";
import { FileInputProperty } from "eez-studio-ui/properties-electron";

import { IFileUploadInstructions } from "instrument/connection/file-upload";

@observer
class FileUploadSettingsDialog extends React.Component<
    {
        instructions: IFileUploadInstructions;
        callback: (instructions: IFileUploadInstructions) => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);
        this.instructions = { ...this.props.instructions };
    }

    @observable instructions: IFileUploadInstructions;

    validator = makeValidator({
        startCommandTemplate: validators.required,
        sendChunkCommandTemplate: validators.required,
        chunkSize: validators.rangeInclusive(1, 4096)
    });

    @bind
    async handleSubmit() {
        if (!(await this.validator.checkValidity(this.instructions))) {
            return false;
        }
        this.props.callback(this.instructions);
        return true;
    }

    render() {
        return (
            <Dialog onOk={this.handleSubmit} size="medium">
                <PropertyList>
                    <BooleanProperty
                        name="Use short (8.3) file names"
                        value={this.instructions.shortFileName}
                        onChange={action(
                            (value: boolean) => (this.instructions.shortFileName = value)
                        )}
                    />

                    <TextInputProperty
                        name="Start command"
                        value={this.instructions.startCommandTemplate}
                        onChange={action(
                            (value: string) => (this.instructions.startCommandTemplate = value)
                        )}
                        errors={this.validator.errors.startCommandTemplate}
                    />

                    <TextInputProperty
                        name="File size command"
                        value={this.instructions.fileSizeCommandTemplate || ""}
                        onChange={action(
                            (value: string) => (this.instructions.fileSizeCommandTemplate = value)
                        )}
                    />

                    <TextInputProperty
                        name="Send one chunk command"
                        value={this.instructions.sendChunkCommandTemplate}
                        onChange={action(
                            (value: string) => (this.instructions.sendChunkCommandTemplate = value)
                        )}
                        errors={this.validator.errors.sendChunkCommandTemplate}
                    />

                    <TextInputProperty
                        name="Finish command"
                        value={this.instructions.finishCommandTemplate || ""}
                        onChange={action(
                            (value: string) => (this.instructions.finishCommandTemplate = value)
                        )}
                    />

                    <TextInputProperty
                        name="Abort command"
                        value={this.instructions.abortCommandTemplate || ""}
                        onChange={action(
                            (value: string) => (this.instructions.abortCommandTemplate = value)
                        )}
                    />

                    <NumberInputProperty
                        name="Chunk size"
                        value={this.instructions.chunkSize}
                        onChange={action((value: number) => (this.instructions.chunkSize = value))}
                        errors={this.validator.errors.chunkSize}
                    />
                </PropertyList>
            </Dialog>
        );
    }
}

function showAdvancedSettingsDialog(
    instructions: IFileUploadInstructions,
    callback: (instructions: IFileUploadInstructions) => void
) {
    showDialog(<FileUploadSettingsDialog instructions={instructions} callback={callback} />);
}

@observer
class FileUploadDialog extends React.Component<
    {
        instructions: IFileUploadInstructions;
        callback: (instructions: IFileUploadInstructions) => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.instructions = { ...this.props.instructions };
    }

    @observable instructions: IFileUploadInstructions;
    @observable destinationFileNameChanged = false;
    @observable destinationFolderPathChanged = false;

    validator = makeValidator({
        sourceFilePath: [
            validators.required,
            async () => {
                if (
                    this.instructions.sourceFilePath &&
                    !(await fileExists(this.instructions.sourceFilePath))
                ) {
                    return "File not found.";
                }
                return null;
            }
        ],

        destinationFileName: [
            validators.required,
            () => {
                if (
                    this.instructions.destinationFileName &&
                    !isValidFileName(
                        this.instructions.destinationFileName,
                        this.instructions.shortFileName
                    )
                ) {
                    return "Invalid file name.";
                }
                return null;
            }
        ],

        destinationFolderPath: [
            () => {
                if (
                    this.instructions.destinationFolderPath &&
                    !isValidPath(
                        this.instructions.destinationFolderPath,
                        this.instructions.shortFileName
                    )
                ) {
                    return "Invalid path.";
                }
                return null;
            }
        ]
    });

    @bind
    async handleSubmit() {
        if (!(await this.validator.checkValidity(this.instructions))) {
            return false;
        }
        this.props.callback(this.instructions);
        return true;
    }

    deriveDestinationFileNameFromSourceFilePath() {
        if (this.instructions.shortFileName) {
            return getShortFileName(this.instructions.sourceFilePath!);
        } else {
            return getValidFileNameFromFileName(getFileName(this.instructions.sourceFilePath!));
        }
    }

    deriveDestinationFolderPathFromSourceFilePath() {
        const sourceFilePath = this.instructions.sourceFilePath;
        const favoriteDestinationPaths = this.instructions.favoriteDestinationPaths;
        if (sourceFilePath && favoriteDestinationPaths) {
            const favoriteDestinationPath = favoriteDestinationPaths.find(
                favoriteDestinationPath =>
                    favoriteDestinationPath.ext &&
                    sourceFilePath!.endsWith(favoriteDestinationPath.ext)
            );
            if (favoriteDestinationPath) {
                return favoriteDestinationPath.path;
            }
        }
        return this.instructions.destinationFolderPath;
    }

    @computed get destinationFoldePathSuggestions() {
        if (this.instructions.favoriteDestinationPaths) {
            return this.instructions.favoriteDestinationPaths
                .map(favoriteDestinationPath => favoriteDestinationPath.path)
                .filter(
                    (favoriteDestinationPath, index, self) =>
                        self.indexOf(favoriteDestinationPath) == index
                );
        }
        return undefined;
    }

    render() {
        return (
            <Dialog
                onOk={this.handleSubmit}
                size="large"
                additionalButton={{
                    id: "settings",
                    type: "secondary",
                    position: "left",
                    onClick: () =>
                        showAdvancedSettingsDialog(
                            this.instructions,
                            action((instructions: IFileUploadInstructions) => {
                                let updateDestinationFileName =
                                    this.instructions.destinationFileName ===
                                    this.deriveDestinationFileNameFromSourceFilePath();

                                Object.assign(this.instructions, instructions);

                                if (updateDestinationFileName) {
                                    this.instructions.destinationFileName = this.deriveDestinationFileNameFromSourceFilePath();
                                }
                            })
                        ),
                    disabled: false,
                    style: { marginRight: "auto" },
                    icon: "material:settings",
                    title: "Show advanced settings"
                }}
            >
                <PropertyList>
                    <FileInputProperty
                        name="Source file path"
                        value={this.instructions.sourceFilePath || ""}
                        onChange={action((value: string) => {
                            this.instructions.sourceFilePath = value;

                            let destinationFileName = this.instructions.destinationFileName;
                            if (destinationFileName) {
                                destinationFileName = destinationFileName.trim();
                            }
                            if (!destinationFileName || !this.destinationFileNameChanged) {
                                this.instructions.destinationFileName = this.deriveDestinationFileNameFromSourceFilePath();
                            }

                            let destinationFolderPath = this.instructions.destinationFolderPath;
                            if (destinationFolderPath) {
                                destinationFolderPath = destinationFolderPath.trim();
                            }
                            if (!destinationFolderPath || !this.destinationFolderPathChanged) {
                                this.instructions.destinationFolderPath = this.deriveDestinationFolderPathFromSourceFilePath();
                            }
                        })}
                        errors={this.validator.errors.sourceFilePath}
                    />

                    <TextInputProperty
                        name="Destination file name"
                        value={this.instructions.destinationFileName}
                        onChange={action((value: string) => {
                            this.instructions.destinationFileName = value;
                            this.destinationFileNameChanged = true;
                        })}
                        errors={this.validator.errors.destinationFileName}
                    />

                    <TextInputProperty
                        name="Destination folder path"
                        value={this.instructions.destinationFolderPath}
                        onChange={action((value: string) => {
                            this.instructions.destinationFolderPath = value;
                            this.destinationFolderPathChanged = true;
                        })}
                        errors={this.validator.errors.destinationFolderPath}
                        suggestions={this.destinationFoldePathSuggestions}
                    />
                </PropertyList>
            </Dialog>
        );
    }
}

export function showFileUploadDialog(
    instructions: IFileUploadInstructions,
    callback: (instructions: IFileUploadInstructions) => void
) {
    showDialog(<FileUploadDialog instructions={instructions} callback={callback} />);
}
