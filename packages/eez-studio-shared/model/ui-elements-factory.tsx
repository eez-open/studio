import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { PropertyInfo } from "eez-studio-shared/model/object";

import { IDialogComponentProps } from "eez-studio-ui/dialog";

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

////////////////////////////////////////////////////////////////////////////////

export const DefaultUIElementsFactory: IUIElementsFactory = {
    Dialog: BootstrapDialog,

    Button: BootstrapButton,

    createMenuItem(config: IMenuItemConfig) {
        // todo
        return {};
    },
    createMenu() {
        // todo
        return {
            append(menuItem: IMenuItem) {},
            popup(options: IMenuPopupOptions) {}
        };
    },
    confirm(message: string, detail: string | undefined, callback: () => void) {
        // todo
    },
    renderProperty(propertyInfo: PropertyInfo, value: any, onChange: (value: any) => void) {
        return null;
    },
    copyToClipboard(text: string) {},
    pasteFromClipboard(): string | undefined {
        return undefined;
    }
};

////////////////////////////////////////////////////////////////////////////////

export type IMenuItemConfig =
    | {
          label: string;
          click?: () => void;
          checked?: boolean;
      }
    | {
          type: "separator";
      };

export interface IMenuItem {}

export interface IMenuPopupOptions {}

export interface IMenuAnchorPosition {
    left: number;
    top: number;
}

export interface IMenu {
    append(menuItem: IMenuItem): void;
    popup(options: IMenuPopupOptions, position: IMenuAnchorPosition): void;
}

export interface IUIElementsFactory {
    Dialog: typeof React.Component;
    Button: typeof React.Component;
    createMenuItem(menuItemConfig: IMenuItemConfig): IMenuItem;
    createMenu(): IMenu;
    confirm(message: string, detail: string | undefined, callback: () => void): void;
    renderProperty(
        propertyInfo: PropertyInfo,
        value: any,
        onChange: (value: any) => void
    ): React.ReactNode;
    copyToClipboard(text: string): void;
    pasteFromClipboard(): string | undefined;
}
