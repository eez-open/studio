import React from "react";
import ReactDOM from "react-dom";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { IDialogComponentProps } from "eez-studio-ui/dialog";
import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";
import { styled } from "eez-studio-ui/styled-components";

////////////////////////////////////////////////////////////////////////////////

const NonModalDialogContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    & > :nth-child(1) {
        flex-grow: 1;
        display: flex;
        overflow: auto;
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
        $(this.div).on("shown.bs.modal", () => {
            setTimeout(() => {
                let element = $(this.div).find(".ql-editor")[0];
                if (element) {
                    element.focus();
                } else {
                    $(this.div)
                        .find(".modal-body")
                        .find("input, textarea, select, .EezStudio_ListContainer, button")
                        .first()
                        .focus();
                }
            });
        });

        $(this.div).on("hidden.bs.modal", () => {
            const parent = this.div.parentElement as HTMLElement;
            ReactDOM.unmountComponentAtNode(parent);
            parent.remove();
            this.props.onCancel();
        });

        $(this.div).modal();
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

        const buttons = props.buttons.map(button =>
            button.text ? (
                <button
                    key={button.id}
                    type="button"
                    className={classNames(
                        "btn",
                        button.text
                            ? {
                                  "btn-primary": button.type === "primary",
                                  "btn-secondary": button.type === "secondary",
                                  "btn-danger": button.type === "danger",
                                  "float-left": button.position === "left"
                              }
                            : "btn-outline-secondary"
                    )}
                    onClick={button.onClick}
                    disabled={button.disabled}
                    style={button.style}
                >
                    {button.text ? button.text : <Icon icon={button.icon!}></Icon>}
                </button>
            ) : (
                <IconAction
                    key={button.id}
                    icon={button.icon!}
                    title={button.title || ""}
                    style={{ color: "#333" }}
                    onClick={button.onClick}
                    enabled={!button.disabled}
                />
            )
        );

        if (props.modal != undefined && !props.modal) {
            return (
                <NonModalDialogContainer>
                    <div>{props.children}</div>
                    <div>
                        {this.props.additionalFooterControl}
                        {buttons}
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
                            {this.props.additionalFooterControl}
                            {buttons}
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
