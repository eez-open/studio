import bootstrap from "bootstrap";
import React from "react";
import ReactDOM from "react-dom";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

export interface IDialogOptions {
    id?: string;
    jsPanel?: {
        title: string;
        width: number;
        height?: number;
    };
    fieldsEnclosureDiv?: React.ComponentType;
}

export function showDialog(dialog: JSX.Element, opts?: IDialogOptions) {
    let element = document.createElement("div");
    if (opts && opts.id) {
        element.id = opts.id;
    }

    ReactDOM.render(dialog, element);

    if (opts && opts.jsPanel) {
        element.style.position = "absolute";
        element.style.width = "100%";
        element.style.height = "100%";
        element.style.display = "flex";

        const jsPanel: any = (window as any).jsPanel;

        const dialog = jsPanel.modal.create({
            container: "#EezStudio_Content",
            theme: "primary",
            headerTitle: opts.jsPanel.title,
            panelSize: {
                width: Math.min(
                    Math.round(window.innerWidth * 0.8),
                    opts.jsPanel.width
                ),
                height: opts.jsPanel.height
                    ? Math.min(
                          Math.round(window.innerHeight * 0.8),
                          opts.jsPanel.height
                      )
                    : Math.round(window.innerHeight * 0.8)
            },
            content: element,
            headerControls: {
                minimize: "remove",
                smallify: "remove"
            },
            dragit: {},
            resizeit: {},
            closeOnBackdrop: false
        });
        return [dialog, element];
    } else {
        document.body.appendChild(element);
        return [undefined, element];
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Dialog extends React.Component<
    {
        modal?: boolean;
        open?: boolean;
        title?: string;
        size?: "small" | "medium" | "large";
        okButtonText?: string;
        cancelButtonText?: string;
        onOk?: () => Promise<boolean> | boolean | void;
        okEnabled?: () => boolean;
        onCancel?: (() => void) | null;
        cancelDisabled?: boolean;
        additionalButton?: IDialogButton;
        additionalFooterControl?: React.ReactNode;
    },
    {}
> {
    @observable disableButtons = false;
    @observable open = true;

    @action
    closeDialog() {
        this.open = false;
    }

    handleSubmit = (event: any) => {
        event.preventDefault();
        event.stopPropagation();

        let result = this.props.onOk!();
        if (result != false) {
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
    };

    onCancel = () => {
        if (this.props.onCancel) {
            this.props.onCancel();
        }

        this.closeDialog();
    };

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
                onClick: this.handleSubmit,
                disabled:
                    this.disableButtons ||
                    (this.props.okEnabled ? !this.props.okEnabled() : false),
                style: {},
                text: this.props.okButtonText || "OK"
            });
        }

        return (
            <BootstrapDialog
                modal={this.props.modal}
                open={
                    this.open &&
                    (this.props.open === undefined || this.props.open)
                }
                size={this.props.size}
                title={this.props.title}
                onSubmit={this.handleSubmit}
                onCancel={this.onCancel}
                cancelDisabled={this.props.cancelDisabled}
                disableButtons={this.disableButtons}
                buttons={buttons}
                additionalFooterControl={this.props.additionalFooterControl}
            >
                {this.props.children}
            </BootstrapDialog>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface IDialogButton {
    id: string;
    type: "primary" | "secondary" | "danger";
    position: "left" | "right";
    onClick: (event: any) => void;
    disabled: boolean;
    style: React.CSSProperties;
    text?: string;
    icon?: string;
    title?: string;
}

@observer
export class BootstrapDialog extends React.Component<{
    modal?: boolean;
    open: boolean;
    size?: "small" | "medium" | "large";
    title: string | undefined;
    onSubmit: (event: React.FormEvent) => void;
    onCancel: () => void;
    cancelDisabled?: boolean;
    okEnabled?: () => boolean;
    disableButtons: boolean;
    buttons: IDialogButton[];
    children: React.ReactNode;
    additionalFooterControl?: React.ReactNode;
}> {
    div: HTMLDivElement | null = null;
    form: HTMLFormElement | null = null;
    modal: bootstrap.Modal | null = null;

    componentDidMount() {
        const div = this.div;
        if (div) {
            $(div).on("shown.bs.modal", () => {
                setTimeout(() => {
                    let element = $(div).find(".ql-editor")[0];
                    if (element) {
                        element.focus();
                    } else {
                        $(div)
                            .find(".modal-body")
                            .find(
                                "input, textarea, select, .EezStudio_ListContainer, button"
                            )
                            .first()
                            .focus();
                    }
                });
            });

            $(div).on("hidden.bs.modal", () => {
                const parent = div.parentElement as HTMLElement;
                ReactDOM.unmountComponentAtNode(parent);
                parent.remove();
                this.props.onCancel();
            });

            this.modal = new bootstrap.Modal(div);
            this.modal.show();
        }
    }

    componentDidUpdate() {
        if (!this.props.open && this.modal) {
            this.modal.hide();
        }
    }

    onKeyPress = (event: React.KeyboardEvent) => {
        if (
            event.which == 13 &&
            !(event.target instanceof HTMLTextAreaElement)
        ) {
            event.preventDefault();
            this.props.onSubmit(event);
        }
    };

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
                    {button.text ? (
                        button.text
                    ) : (
                        <Icon icon={button.icon!}></Icon>
                    )}
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
                <div className="EezStudio_NonModalDialogContainer">
                    <div>{props.children}</div>
                    <div>
                        {this.props.additionalFooterControl}
                        {buttons}
                    </div>
                </div>
            );
        }

        let formClassName = classNames("modal-dialog", {
            "modal-lg": props.size === "large",
            "modal-sm": props.size === "small"
        });

        return (
            <div
                ref={ref => (this.div = ref!)}
                className="modal"
                tabIndex={-1}
                role="dialog"
            >
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
                                        className="btn-close float-right"
                                        disabled={props.disableButtons}
                                        aria-label="Close"
                                    ></button>
                                )}
                            </div>
                        )}

                        <div className="modal-body">{props.children}</div>

                        <div
                            className="modal-footer"
                            style={{ justifyContent: "flex-start" }}
                        >
                            {this.props.additionalFooterControl}
                            {buttons}
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}
