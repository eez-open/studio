import React from "react";
import { observer } from "mobx-react";

export const Checkbox = observer(
    class Checkbox extends React.Component<{
        state: boolean | undefined;
        label?: string;
        onChange: (value: boolean) => void;
        readOnly: boolean;
        switchStyle?: boolean;
    }> {
        inputRef = React.createRef<HTMLInputElement>();

        updateIndeterminate() {
            if (this.inputRef.current) {
                this.inputRef.current.indeterminate =
                    this.props.state == undefined;
            }
        }

        componentDidMount() {
            this.updateIndeterminate();
        }

        componentDidUpdate() {
            this.updateIndeterminate();
        }

        render() {
            const innerInput = (
                <input
                    ref={this.inputRef}
                    className="form-check-input"
                    type="checkbox"
                    role={this.props.switchStyle ? "switch" : undefined}
                    checked={this.props.state ? true : false}
                    onChange={event =>
                        this.props.onChange(event.target.checked)
                    }
                    disabled={this.props.readOnly}
                />
            );
            const input = this.props.switchStyle ? (
                <div className="form-check form-switch">&nbsp;{innerInput}</div>
            ) : (
                innerInput
            );

            if (this.props.label === undefined) {
                return input;
            }

            return (
                <div className="form-check">
                    <label className="form-check-label">
                        {input}
                        {this.props.label}
                    </label>
                </div>
            );
        }
    }
);
