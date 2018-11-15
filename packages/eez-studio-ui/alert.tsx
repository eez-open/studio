import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

@observer
export class Alert extends React.Component<
    {
        onDismiss?: () => void;
        className: string;
    },
    {}
> {
    render() {
        let className = classNames("alert", this.props.className);

        return (
            <div className={className} role="alert">
                {this.props.onDismiss && (
                    <button
                        type="button"
                        className="close"
                        aria-label="Close"
                        onClick={this.props.onDismiss}
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                )}
                {this.props.children}
            </div>
        );
    }
}

@observer
export class AlertDanger extends React.Component<
    {
        onDismiss?: () => void;
        className?: string;
    },
    {}
> {
    render() {
        let className = classNames("alert-danger", this.props.className);

        return (
            <Alert className={className} onDismiss={this.props.onDismiss}>
                {this.props.children}
            </Alert>
        );
    }
}
