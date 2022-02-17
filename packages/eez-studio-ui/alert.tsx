import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

export const Alert = observer(
    class Alert extends React.Component<
        {
            onDismiss?: () => void;
            className?: string;
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
                            className="btn-close"
                            aria-label="Close"
                            onClick={this.props.onDismiss}
                        ></button>
                    )}
                    {this.props.children}
                </div>
            );
        }
    }
);

export const AlertDanger = observer(
    class AlertDanger extends React.Component<
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
);
