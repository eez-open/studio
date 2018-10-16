import * as React from "react";

import { Icon } from "shared/ui/icon";
import { FieldComponent } from "shared/ui/generic-dialog";

import { ProjectStore } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

export class RelativeFileInput extends FieldComponent {
    onClear() {
        this.props.onChange(undefined);
    }

    onSelect() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            {
                properties: ["openFile"],
                filters: this.props.fieldProperties.options.filters
            },
            filePaths => {
                if (filePaths && filePaths[0]) {
                    this.props.onChange(
                        ProjectStore.getFilePathRelativeToProjectPath(filePaths[0])
                    );
                }
            }
        );
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
