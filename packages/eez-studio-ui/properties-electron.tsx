import React from "react";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";

import { PropertyEnclosure } from "eez-studio-ui/properties";

@observer
export class FileInputProperty extends React.Component<
    {
        id?: string;
        name?: string;
        value: string;
        onChange: (value: string) => void;
        advanced?: boolean;
        errors?: string[];
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.onSelectFile = this.onSelectFile.bind(this);
    }

    async onSelectFile(event: any) {
        event.preventDefault();

        const result = await EEZStudio.electron.remote.dialog.showOpenDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            {
                properties: ["openFile"],
                filters: [{ name: "All Files", extensions: ["*"] }]
            }
        );

        const filePaths = result.filePaths;
        if (filePaths && filePaths[0]) {
            this.props.onChange(filePaths[0]);
        }
    }

    render() {
        let id = this.props.id || guid();

        let input = (
            <div className="input-group">
                <input
                    id={id}
                    className="form-control"
                    type="text"
                    value={this.props.value}
                    onChange={event => this.props.onChange(event.target.value)}
                />
                <div className="input-group-append">
                    <button
                        className="btn btn-secondary"
                        title="Select file"
                        onClick={this.onSelectFile}
                    >
                        &hellip;
                    </button>
                </div>
            </div>
        );

        let content;
        if (this.props.name) {
            content = [
                <td key="name">
                    <label className="PropertyName col-form-label" htmlFor={id}>
                        {this.props.name}
                    </label>
                </td>,
                <td key="value">{input}</td>
            ];
        } else {
            content = <td colSpan={2}>{input}</td>;
        }

        return (
            <PropertyEnclosure advanced={this.props.advanced || false} errors={this.props.errors}>
                {content}
            </PropertyEnclosure>
        );
    }
}
