import React from "react";

import { Icon } from "eez-studio-ui/icon";
import { FieldComponent } from "eez-studio-ui/generic-dialog";

import { ProjectStore } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export class RelativeFileInput extends FieldComponent {
    onClear() {
        this.props.onChange(undefined);
    }

    async onSelect() {
        const result = await EEZStudio.electron.remote.dialog.showOpenDialog({
            properties: ["openFile"],
            filters: this.props.fieldProperties.options.filters
        });

        if (result.filePaths && result.filePaths[0]) {
            this.props.onChange(ProjectStore.getFilePathRelativeToProjectPath(result.filePaths[0]));
        }
    }

    render() {
        let clearButton: JSX.Element | undefined;

        if (this.props.values[this.props.fieldProperties.name]) {
            clearButton = (
                <button className="btn btn-default" type="button" onClick={this.onClear.bind(this)}>
                    <Icon icon="material:close" size={17} />
                </button>
            );
        }

        return (
            <div className="input-group">
                <input
                    type="text"
                    className="form-control"
                    value={this.props.values[this.props.fieldProperties.name] || ""}
                    readOnly
                />
                <div className="input-group-append">
                    {clearButton}
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={this.onSelect.bind(this)}
                    >
                        &hellip;
                    </button>
                </div>
            </div>
        );
    }
}
