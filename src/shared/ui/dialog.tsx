import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable, action } from "mobx";
import * as classNames from "classnames";
import { observer } from "mobx-react";
import bind from "bind-decorator";

@observer
export class Dialog extends React.Component<
    {
        title?: string;
        large?: boolean;
        okButtonText?: string;
        onOk?: () => Promise<boolean> | boolean;
        onCancel?: () => void;
        additionalButton?: JSX.Element;
    },
    {}
> {
    refs: {
        div: HTMLDivElement;
        form: HTMLFormElement;
    };

    @observable disableButtons = false;

    componentDidMount() {
        $(this.refs.div).modal({
            backdrop: "static"
        });

        $(this.refs.div).on("shown.bs.modal", () => {
            let element = $(this.refs.div).find(".ql-editor")[0];
            if (element) {
                element.focus();
            } else {
                $(this.refs.div)
                    .find(".modal-body")
                    .find("input, textarea, .EezStudio_ListContainer")
                    .first()
                    .focus();
            }
        });

        $(this.refs.div).on("hidden.bs.modal", () => {
            (this.refs.div.parentElement as HTMLElement).remove();
        });
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
                        $(this.refs.div).modal("hide");
                    }
                });
            } else {
                $(this.refs.div).modal("hide");
            }
        }
    }

    @bind
    onCancel() {
        if (this.props.onCancel) {
            this.props.onCancel();
        }
        $(this.refs.div).modal("hide");
    }

    render() {
        let formClassName = classNames("modal-dialog", {
            "modal-lg": this.props.large === true
        });

        return (
            <div ref="div" className="modal fade" tabIndex={-1} role="dialog">
                <form
                    ref="form"
                    className={formClassName}
                    role="document"
                    onSubmit={this.handleSumbit}
                >
                    <div className="modal-content">
                        {this.props.title && (
                            <div className="modal-header">
                                <h5 className="modal-title" id="myModalLabel">
                                    {this.props.title}
                                </h5>
                                <button
                                    type="button"
                                    className="close float-right"
                                    onClick={this.onCancel}
                                    disabled={this.disableButtons}
                                    aria-label="Close"
                                >
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                        )}

                        <div className="modal-body">{this.props.children}</div>

                        <div className="modal-footer" style={{ justifyContent: "flex-start" }}>
                            {this.props.additionalButton}

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={this.onCancel}
                                disabled={this.disableButtons}
                                style={{ marginLeft: "auto" }}
                            >
                                Cancel
                            </button>

                            {this.props.onOk && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={this.disableButtons}
                                    onClick={this.handleSumbit}
                                >
                                    {this.props.okButtonText || "OK"}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

export function showDialog(dialog: JSX.Element, id?: string) {
    let element = document.createElement("div");
    if (id) {
        element.id = id;
    }
    ReactDOM.render(dialog, element);
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
