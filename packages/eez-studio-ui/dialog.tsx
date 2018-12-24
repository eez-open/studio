import React from "react";
import ReactDOM from "react-dom";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import bind from "bind-decorator";
import classNames from "classnames";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import { UIElementsFactory } from "eez-studio-shared/model/store";

////////////////////////////////////////////////////////////////////////////////

export interface IDialogButton {
    id: string;
    type: "primary" | "secondary" | "danger";
    position: "left" | "right";
    onClick: (event: any) => void;
    disabled: boolean;
    style: React.CSSProperties;
    text: string;
}

export interface IDialogComponentProps {
    open: boolean;
    size?: "small" | "medium" | "large";
    title: string | undefined;
    onSubmit: (event: React.FormEvent) => void;
    onCancel: () => void;
    cancelDisabled?: boolean;
    disableButtons: boolean;
    buttons: IDialogButton[];
    children: React.ReactNode;
}

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
        if (event.which == 13) {
            event.preventDefault();
            this.props.onSubmit(event);
        }
    }

    render() {
        const props = this.props;

        let formClassName = classNames("modal-dialog", {
            "modal-lg": props.size === "large",
            "modal-sm": props.size === "small"
        });

        return (
            <div ref={ref => (this.div = ref!)} className="modal fade" tabIndex={-1} role="dialog">
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

@observer
export class Dialog extends React.Component<
    {
        open?: boolean;
        title?: string;
        size?: "small" | "medium" | "large";
        okButtonText?: string;
        cancelButtonText?: string;
        onOk?: () => Promise<boolean> | boolean;
        onCancel?: (() => void) | null;
        cancelDisabled?: boolean;
        additionalButton?: IDialogButton;
    },
    {}
> {
    @observable
    disableButtons = false;

    @observable
    open = true;

    @action
    closeDialog() {
        this.open = false;
    }

    @bind
    handleSumbit(event: any) {
        event.preventDefault();
        event.stopPropagation();

        let result = this.props.onOk!();
        if (result) {
            if (result instanceof Promise) {
                action(() => (this.disableButtons = true))();
                result.then(isValid => {
                    action(() => (this.disableButtons = false))();
                    if (isValid) {
                        this.closeDialog();
                    }
                });
            } else {
                this.closeDialog();
            }
        }
    }

    @bind
    onCancel() {
        if (this.props.onCancel) {
            this.props.onCancel();
        }

        this.closeDialog();
    }

    render() {
        const buttons: IDialogButton[] = [];

        if (this.props.additionalButton) {
            buttons.push(this.props.additionalButton);
        }

        if (!this.props.cancelDisabled) {
            buttons.push({
                id: "cancel",
                type: "secondary",
                position: "right",
                onClick: this.onCancel,
                disabled: this.disableButtons,
                style: { marginLeft: "auto" },
                text: this.props.cancelButtonText || "Cancel"
            });
        }

        if (this.props.onOk) {
            buttons.push({
                id: "ok",
                type: "primary",
                position: "right",
                onClick: this.handleSumbit,
                disabled: this.disableButtons,
                style: {},
                text: this.props.okButtonText || "OK"
            });
        }

        const DialogImplementation = UIElementsFactory.Dialog || BootstrapDialog;

        return (
            <DialogImplementation
                open={this.open && (this.props.open === undefined || this.props.open)}
                size={this.props.size}
                title={this.props.title}
                onSubmit={this.handleSumbit}
                onCancel={this.onCancel}
                cancelDisabled={this.props.cancelDisabled}
                disableButtons={this.disableButtons}
                buttons={buttons}
            >
                {this.props.children}
            </DialogImplementation>
        );
    }
}

export function showDialog(dialog: JSX.Element, id?: string) {
    let element = document.createElement("div");
    if (id) {
        element.id = id;
    }
    ReactDOM.render(<ThemeProvider theme={theme}>{dialog}</ThemeProvider>, element);
    document.body.appendChild(element);
}

export function info(message: string, detail: string | undefined) {
    EEZStudio.electron.remote.dialog.showMessageBox(EEZStudio.electron.remote.getCurrentWindow(), {
        type: "info",
        title: "EEZ Studio",
        message: message,
        detail: detail,
        noLink: true,
        buttons: ["OK"]
    });
}

export function error(message: string, detail: string | undefined) {
    EEZStudio.electron.remote.dialog.showMessageBox(EEZStudio.electron.remote.getCurrentWindow(), {
        type: "error",
        title: "EEZ Studio",
        message: message,
        detail: detail,
        noLink: true,
        buttons: ["OK"]
    });
}

export function confirm(
    message: string,
    detail: string | undefined,
    callback: () => void,
    cancelCallback?: () => void
) {
    EEZStudio.electron.remote.dialog.showMessageBox(
        EEZStudio.electron.remote.getCurrentWindow(),
        {
            type: "question",
            title: "EEZ Studio",
            message: message,
            detail: detail,
            noLink: true,
            buttons: ["Yes", "No"],
            cancelId: 1
        },
        function(buttonIndex) {
            if (buttonIndex == 0) {
                callback();
            } else if (cancelCallback) {
                cancelCallback();
            }
        }
    );
}

export function confirmWithButtons(message: string, detail: string | undefined, buttons: string[]) {
    return new Promise<number>(resolve => {
        EEZStudio.electron.remote.dialog.showMessageBox(
            EEZStudio.electron.remote.getCurrentWindow(),
            {
                type: "question",
                title: "EEZ Studio",
                message: message,
                detail: detail,
                noLink: true,
                buttons: buttons || ["Yes", "No"],
                cancelId: 1
            },
            buttonIndex => {
                resolve(buttonIndex);
            }
        );
    });
}
