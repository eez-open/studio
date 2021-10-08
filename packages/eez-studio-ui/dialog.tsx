import React from "react";
import ReactDOM from "react-dom";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import bind from "bind-decorator";

import { BootstrapDialog } from "project-editor/components/BootstrapDialog";

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

export interface IDialogComponentProps {
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

    @bind
    handleSubmit(event: any) {
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
