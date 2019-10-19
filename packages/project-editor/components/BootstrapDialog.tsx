import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { IDialogComponentProps } from "eez-studio-ui/dialog";
import { styled } from "eez-studio-ui/styled-components";

////////////////////////////////////////////////////////////////////////////////

const NonModalDialogContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    & > :nth-child(1) {
        flex-grow: 1;
        display: flex;
    }
    & > :nth-child(2) {
        padding: 10px;
        display: flex;
        justify-content: "flex-end";
        border-top: 1px solid ${props => props.theme.borderColor};
        background-color: ${props => props.theme.panelHeaderColor};

        & > button {
            margin-left: 10px;
        }
    }
`;

////////////////////////////////////////////////////////////////////////////////

@observer
export class BootstrapDialog extends React.Component<IDialogComponentProps> {
    div: HTMLDivElement;
    form: HTMLFormElement;

    componentDidMount() {
        $(this.div).modal({
            backdrop: "static"
        });

        $(this.div).on("shown.bs.modal", () => {
            let element = $(this.div).find(".ql-editor")[0];
            if (element) {
                element.focus();
            } else {
                $(this.div)
                    .find(".modal-body")
                    .find("input, textarea, .EezStudio_ListContainer")
                    .first()
                    .focus();
            }
        });

        $(this.div).on("hidden.bs.modal", () => {
            (this.div.parentElement as HTMLElement).remove();
        });
    }

    componentDidUpdate() {
        if (!this.props.open) {
            $(this.div).modal("hide");
        }
    }

    @bind
    onKeyPress(event: React.KeyboardEvent) {
        if (event.which == 13 && !(event.target instanceof HTMLTextAreaElement)) {
            event.preventDefault();
            this.props.onSubmit(event);
        }
    }

    render() {
        const props = this.props;

        if (props.modal != undefined && !props.modal) {
            return (
                <NonModalDialogContainer>
                    <div>{props.children}</div>
                    <div>
                        {props.buttons.map(button => (
                            <button
                                key={button.id}
                                type="button"
                                className={classNames("btn", {
                                    "btn-primary": button.type === "primary",
                                    "btn-secondary": button.type === "secondary",
                                    "btn-danger": button.type === "danger",
                                    "float-left": button.position === "left"
                                })}
                                onClick={button.onClick}
                                disabled={button.disabled}
                                style={button.style}
                            >
                                {button.text}
                            </button>
                        ))}
                    </div>
                </NonModalDialogContainer>
            );
        }

        let formClassName = classNames("modal-dialog", {
            "modal-lg": props.size === "large",
            "modal-sm": props.size === "small"
        });

        return (
            <div ref={ref => (this.div = ref!)} className="modal" tabIndex={-1} role="dialog">
                <form
                    ref={ref => (this.form = ref!)}
                    className={formClassName}
                    role="document"
                    onSubmit={event => props.onSubmit}
                    onKeyPress={this.onKeyPress}
                >
                    <div className="modal-content">
                        {props.title && (
                            <div className="modal-header">
                                <h5 className="modal-title" id="myModalLabel">
                                    {props.title}
                                </h5>
                                {!this.props.cancelDisabled && (
                                    <button
                                        type="button"
                                        className="close float-right"
                                        onClick={props.onCancel}
                                        disabled={props.disableButtons}
                                        aria-label="Close"
                                    >
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="modal-body">{props.children}</div>

                        <div className="modal-footer" style={{ justifyContent: "flex-start" }}>
                            {props.buttons.map(button => (
                                <button
                                    key={button.id}
                                    type="button"
                                    className={classNames("btn", {
                                        "btn-primary": button.type === "primary",
                                        "btn-secondary": button.type === "secondary",
                                        "btn-danger": button.type === "danger",
                                        "float-left": button.position === "left"
                                    })}
                                    onClick={button.onClick}
                                    disabled={button.disabled}
                                    style={button.style}
                                >
                                    {button.text}
                                </button>
                            ))}
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class BootstrapButton extends React.Component<{
    color: "primary" | "secondary";
    size: "small" | "medium" | "large";
    onClick: () => void;
}> {
    render() {
        const { color, size, onClick } = this.props;
        const className = classNames("btn", {
            "btn-sm": size === "small",
            "btn-lg": size === "large",
            "btn-primary": color === "primary",
            "btn-secondary": color === "secondary"
        });

        return (
            <button className={className} onClick={onClick}>
                {this.props.children}
            </button>
        );
    }
}
