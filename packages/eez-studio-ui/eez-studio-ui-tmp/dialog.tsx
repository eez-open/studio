import React from "react";
import ReactDOM from "react-dom";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import bind from "bind-decorator";

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

        const DialogImplementation = UIElementsFactory.Dialog;

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
