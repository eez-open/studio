import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import {
    getFileName,
    getValidFileNameFromFileName,
    getShortFileName,
    fileExists,
    isValidFileName,
    isValidPath
} from "eez-studio-shared/util";

import { makeValidator, validators } from "eez-studio-shared/model/validation";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import {
    PropertyList,
    TextInputProperty,
    NumberInputProperty,
    BooleanProperty,
    FileInputProperty
} from "eez-studio-ui/properties";

import { IFileUploadInstructions } from "instrument/connection/file-upload";

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

        this.handleSubmit = this.handleSubmit.bind(this);

        this.instructions = { ...this.props.instructions };
    }

    @observable instructions: IFileUploadInstructions;
    @observable destinationFileNameChanged = false;

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
        ],

        startCommandTemplate: validators.required,
        sendChunkCommandTemplate: validators.required,
        chunkSize: validators.rangeInclusive(1, 1024)
    });

    async handleSubmit() {
        if (!(await this.validator.checkValidity(this.instructions))) {
            return false;
        }
        this.props.callback(this.instructions);
        return true;
    }

    deriveDestinationFileNameFromSourceFilePath() {
        if (this.instructions.shortFileName) {
            return getShortFileName(this.instructions.sourceFilePath);
        } else {
            return getValidFileNameFromFileName(getFileName(this.instructions.sourceFilePath));
        }
    }

    render() {
        return (
            <Dialog onOk={this.handleSubmit} large={true}>
                <PropertyList withAdvancedProperties={true}>
                    <FileInputProperty
                        name="Source file path"
                        value={this.instructions.sourceFilePath}
                        onChange={action((value: string) => {
                            this.instructions.sourceFilePath = value;

                            let destinationFileName = this.instructions.destinationFileName;
                            if (destinationFileName) {
                                destinationFileName = destinationFileName.trim();
                            }
                            if (!destinationFileName || !this.destinationFileNameChanged) {
                                this.instructions.destinationFileName = this.deriveDestinationFileNameFromSourceFilePath();
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
                        onChange={action(
                            (value: string) => (this.instructions.destinationFolderPath = value)
                        )}
                        errors={this.validator.errors.destinationFolderPath}
                    />

                    <BooleanProperty
                        name="Use short (8.3) file names"
                        value={this.instructions.shortFileName}
                        onChange={action((value: boolean) => {
                            let updateDestinationFileName =
                                this.instructions.destinationFileName ===
                                this.deriveDestinationFileNameFromSourceFilePath();

                            this.instructions.shortFileName = value;

                            if (updateDestinationFileName) {
                                this.instructions.destinationFileName = this.deriveDestinationFileNameFromSourceFilePath();
                            }
                        })}
                        advanced={true}
                    />

                    <TextInputProperty
                        name="Start command"
                        value={this.instructions.startCommandTemplate}
                        onChange={action(
                            (value: string) => (this.instructions.startCommandTemplate = value)
                        )}
                        advanced={true}
                        errors={this.validator.errors.startCommandTemplate}
                    />

                    <TextInputProperty
                        name="File size command"
                        value={this.instructions.fileSizeCommandTemplate || ""}
                        onChange={action(
                            (value: string) => (this.instructions.fileSizeCommandTemplate = value)
                        )}
                        advanced={true}
                    />

                    <TextInputProperty
                        name="Send one chunk command"
                        value={this.instructions.sendChunkCommandTemplate}
                        onChange={action(
                            (value: string) => (this.instructions.sendChunkCommandTemplate = value)
                        )}
                        advanced={true}
                        errors={this.validator.errors.sendChunkCommandTemplate}
                    />

                    <TextInputProperty
                        name="Finish command"
                        value={this.instructions.finishCommandTemplate || ""}
                        onChange={action(
                            (value: string) => (this.instructions.finishCommandTemplate = value)
                        )}
                        advanced={true}
                    />

                    <TextInputProperty
                        name="Abort command"
                        value={this.instructions.abortCommandTemplate || ""}
                        onChange={action(
                            (value: string) => (this.instructions.abortCommandTemplate = value)
                        )}
                        advanced={true}
                    />

                    <NumberInputProperty
                        name="Chunk size"
                        value={this.instructions.chunkSize}
                        onChange={action((value: number) => (this.instructions.chunkSize = value))}
                        advanced={true}
                        errors={this.validator.errors.chunkSize}
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
