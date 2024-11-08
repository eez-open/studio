import fs from "fs";
import bootstrap from "bootstrap";
import React from "react";
import { createRoot } from "react-dom/client";
import {
    observable,
    computed,
    action,
    autorun,
    Lambda,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import { humanize } from "eez-studio-shared/string";

import { Loader } from "eez-studio-ui/loader";

import { createObject, objectToJS, ProjectStore } from "project-editor/store";
import { InstrumentCommand } from "project-editor/features/instrument-commands/instrument-commands";
import { ProjectContext } from "project-editor/project/context";
import type { Project } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

interface CommandDefinition {
    command: string;
    helpLink?: string;
}

interface Changes {
    added: CommandDefinition[];
    deleted: CommandDefinition[];
    updated: CommandDefinition[];
}

class FindChanges {
    constructor(private projectStore: ProjectStore) {}

    cleanUpScpiCommand(command: string) {
        command = command.trim();

        let i = command.lastIndexOf(" ");
        if (i !== -1) {
            command = command.slice(i + 1);
        }

        if (command.indexOf("(") != -1 || command.indexOf(")") != -1) {
            return undefined;
        }

        let m = command.match(/[A-Z]{3,}/);
        if (!m) {
            // no 3 or more upper case letters
            return false;
        }

        if (command.length < 4) {
            return undefined;
        }

        return command;
    }

    getCommandFromSyntax(command: string) {
        command = command.trim();

        let i = command.indexOf(" ");
        if (i !== -1) {
            return command.slice(0, i);
        }

        return command;
    }

    getCommandsFromInstrumentFileDoc(
        file: string,
        anchorElements: NodeListOf<Element>
    ) {
        let commands: CommandDefinition[] = [];

        let commandBookmark: string | undefined;

        for (let i = 0; i < anchorElements.length; i++) {
            let bookmark = anchorElements[i].getAttribute("name");
            if (bookmark) {
                let parentElement = anchorElements[i].parentElement;
                if (parentElement != null) {
                    let text = parentElement.textContent;
                    if (text) {
                        if (bookmark.startsWith("_eez-iext-cmd_")) {
                            commands.push({
                                command: this.getCommandFromSyntax(text),
                                helpLink:
                                    file + "#" + (commandBookmark || bookmark)
                            });
                        } else {
                            commandBookmark = bookmark;
                        }
                    }
                }
            }
        }

        return commands;
    }

    getCommandsFromScpiDoc() {
        return new Promise<CommandDefinition[]>((resolve, reject) => {
            if (
                this.projectStore.project.settings.general.commandsDocFolder ===
                undefined
            ) {
                reject(
                    this.projectStore.project.scpi
                        ? "SCPI help folder is not defined"
                        : "Commands help folder is not defined"
                );
                return;
            }

            let commandsHelpFolderPath = this.projectStore.getAbsoluteFilePath(
                this.projectStore.project.settings.general.commandsDocFolder
            );

            fs.exists(commandsHelpFolderPath, (exists: boolean) => {
                if (!exists) {
                    reject(
                        this.projectStore.project.scpi
                            ? `SCPI help folder "${commandsHelpFolderPath}" doesn't exists.`
                            : `Commands help folder "${commandsHelpFolderPath}" doesn't exists.`
                    );
                } else {
                    fs.readdir(
                        commandsHelpFolderPath,
                        (err: any, files: string[]) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            files = files.filter(file => file.endsWith("html"));

                            let promises: Promise<CommandDefinition[]>[] =
                                files.map(file => {
                                    return new Promise<CommandDefinition[]>(
                                        (resolve, reject) => {
                                            fs.readFile(
                                                commandsHelpFolderPath +
                                                    "/" +
                                                    file,
                                                "utf-8",
                                                (err: any, data: string) => {
                                                    if (!err) {
                                                        let element =
                                                            document.createElement(
                                                                "div"
                                                            );
                                                        element.innerHTML =
                                                            data;
                                                        let anchorElements =
                                                            element.querySelectorAll(
                                                                "A[name]"
                                                            );
                                                        let commands =
                                                            this.getCommandsFromInstrumentFileDoc(
                                                                file,
                                                                anchorElements
                                                            );
                                                        resolve(commands);
                                                    } else {
                                                        resolve([]);
                                                    }
                                                }
                                            );
                                        }
                                    );
                                });

                            Promise.all(promises)
                                .then(results => {
                                    let allCommands: CommandDefinition[] = [];

                                    results.forEach(commands => {
                                        if (commands) {
                                            allCommands =
                                                allCommands.concat(commands);
                                        }
                                    });

                                    resolve(allCommands);
                                })
                                .catch(err => reject(err));
                        }
                    );
                }
            });
        });
    }

    static compareCommandDefinitions(
        a: CommandDefinition,
        b: CommandDefinition
    ) {
        let c1 = a.command.toUpperCase();
        let c2 = b.command.toUpperCase();
        return c1 < c2 ? -1 : c1 > c2 ? 1 : 0;
    }

    findMissingCommands(
        commands1: CommandDefinition[],
        commands2: CommandDefinition[]
    ) {
        let missingCommands: CommandDefinition[] = [];

        commands1.forEach(command1 => {
            if (
                !commands2.find(
                    command2 => command1.command == command2.command
                )
            ) {
                missingCommands.push(command1);
            }
        });

        return missingCommands.sort(FindChanges.compareCommandDefinitions);
    }

    getChanges() {
        return new Promise<Changes>((resolve, reject) => {
            this.getCommandsFromScpiDoc()
                .then(commands => {
                    let existingCommands = objectToJS(
                        this.projectStore.project.instrumentCommands.commands
                    ) as CommandDefinition[];

                    // added
                    let added = this.findMissingCommands(
                        commands,
                        existingCommands
                    );

                    // deleted
                    let deleted = this.findMissingCommands(
                        existingCommands,
                        commands
                    );

                    // updated
                    let updated: CommandDefinition[] = [];
                    existingCommands.forEach(existingCommand => {
                        commands.forEach(command => {
                            if (
                                command.command == existingCommand.command &&
                                command.helpLink != existingCommand.helpLink
                            ) {
                                updated.push(command);
                            }
                        });
                    });

                    resolve({
                        added,
                        deleted,
                        updated
                    });
                })
                .catch(reject);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

function findInstrumentCommand(project: Project, commandName: string) {
    for (const command of project.instrumentCommands.commands) {
        if (command.command === commandName) {
            return command;
        }
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

type Section = "added" | "deleted" | "updated";

const SECTIONS: Section[] = ["added", "deleted", "updated"];

export const ImportCommandsDocDialog = observer(
    class ImportCommandsDocDialog extends React.Component<{
        onHidden: () => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                changes: observable,
                selectedChanges: observable,
                error: observable,
                activeTab: observable,
                hasChanges: computed,
                hasSelectedChanges: computed,
                onOk: action,
                handleTabClick: action,
                handleSelectCommand: action
            });
        }

        dialog: HTMLDivElement;
        modal: bootstrap.Modal;
        addedSelectAllCheckbox: HTMLInputElement;
        deletedSelectAllCheckbox: HTMLInputElement;
        updatedSelectAllCheckbox: HTMLInputElement;

        changes: Changes;
        selectedChanges: Changes = {
            added: [],
            deleted: [],
            updated: []
        };
        error: any;
        activeTab: Section;
        selectAllCheckboxDisposers: {
            added?: Lambda;
            deleted?: Lambda;
            updated?: Lambda;
        } = {};

        get hasChanges() {
            return (
                this.changes.added.length > 0 ||
                this.changes.deleted.length > 0 ||
                this.changes.updated.length > 0
            );
        }

        get hasSelectedChanges() {
            return (
                this.selectedChanges.added.length > 0 ||
                this.selectedChanges.deleted.length > 0 ||
                this.selectedChanges.updated.length > 0
            );
        }

        componentDidMount() {
            $(this.dialog).on("hidden.bs.modal", () => {
                this.props.onHidden();
            });

            this.modal = new bootstrap.Modal(this.dialog);
            this.modal.show();

            const findChanges = new FindChanges(this.context);

            findChanges
                .getChanges()
                .then(
                    action((changes: Changes) => {
                        this.changes = changes;

                        if (changes.added.length > 0) {
                            this.activeTab = "added";
                        } else if (changes.deleted.length > 0) {
                            this.activeTab = "deleted";
                        } else if (changes.updated.length > 0) {
                            this.activeTab = "updated";
                        }
                    })
                )
                .catch(
                    action((err: any) => {
                        this.error = err;
                    })
                );

            this.handleSelectAllCheckboxes();
        }

        componentDidUpdate() {
            this.handleSelectAllCheckboxes();
        }

        componentWillUnmount() {
            SECTIONS.forEach(section => {
                let disposer = this.selectAllCheckboxDisposers[section];
                if (disposer) {
                    disposer();
                }
            });
        }

        onOkCalled = false;

        onOk = (event: any) => {
            event.preventDefault();

            if (this.onOkCalled) {
                return;
            }

            this.onOkCalled = true;

            this.context.backgroundCheckEnabled = false;

            this.modal.hide();

            this.context.undoManager.setCombineCommands(true);

            this.selectedChanges.added.forEach(commandDefinition => {
                const command = createObject<InstrumentCommand>(
                    this.context,
                    commandDefinition as any,
                    InstrumentCommand
                );

                this.context.addObject(
                    this.context.project.instrumentCommands.commands,
                    command
                );
            });

            this.selectedChanges.deleted.forEach(commandDefinition => {
                let instrumentCommand = findInstrumentCommand(
                    this.context.project,
                    commandDefinition.command
                );
                if (instrumentCommand) {
                    this.context.deleteObject(instrumentCommand);
                }
            });

            this.selectedChanges.updated.forEach(commandDefinition => {
                let InstrumentCommand = findInstrumentCommand(
                    this.context.project,
                    commandDefinition.command
                );
                if (InstrumentCommand) {
                    this.context.updateObject(InstrumentCommand, {
                        helpLink: commandDefinition.helpLink
                    });
                }
            });

            this.context.undoManager.setCombineCommands(false);

            this.context.backgroundCheckEnabled = true;
        };

        onCancel = () => {
            this.modal.hide();
        };

        handleTabClick(activeTab: Section, event: any) {
            event.preventDefault();
            this.activeTab = activeTab;
        }

        handleSelectAllCheckboxes() {
            SECTIONS.forEach(section => {
                if (this.selectAllCheckboxDisposers[section]) {
                    return;
                }

                let checkbox: HTMLInputElement;

                if (section === "added") {
                    checkbox = this.addedSelectAllCheckbox;
                } else if (section === "deleted") {
                    checkbox = this.deletedSelectAllCheckbox;
                } else {
                    // section === "updated"
                    checkbox = this.updatedSelectAllCheckbox;
                }

                if (!checkbox) {
                    return;
                }

                this.selectAllCheckboxDisposers[section] = autorun(() => {
                    if (this.selectedChanges[section].length == 0) {
                        checkbox.indeterminate = false;
                        checkbox.checked = false;
                    } else if (
                        this.selectedChanges[section].length ==
                        this.changes[section].length
                    ) {
                        checkbox.indeterminate = false;
                        checkbox.checked = true;
                    } else {
                        checkbox.indeterminate = true;
                        checkbox.checked = false;
                    }
                });

                checkbox.addEventListener(
                    "click",
                    action((event: any) => {
                        if (this.selectedChanges[section].length == 0) {
                            (this.selectedChanges as any)[section] =
                                this.changes[section].slice();
                        } else {
                            this.selectedChanges[section] = [];
                        }
                    })
                );
            });
        }

        isChangeSelected(
            section: Section,
            changeDefinition: CommandDefinition
        ) {
            let commandDefinitions: any = this.selectedChanges[section];
            return commandDefinitions.indexOf(changeDefinition) !== -1;
        }

        handleSelectCommand(
            section: Section,
            commandDefinition: CommandDefinition,
            event: any
        ) {
            let commandDefinitions: any = this.selectedChanges[section];
            if (event.target.checked) {
                commandDefinitions.push(commandDefinition);
            } else {
                let i = commandDefinitions.indexOf(commandDefinition);
                commandDefinitions.splice(i, 1);
            }
        }

        render() {
            let content;

            let buttons;

            if (this.error) {
                content = <div className="error">{this.error}</div>;

                buttons = [
                    <button
                        key="close"
                        type="button"
                        className="btn btn-primary"
                        onClick={this.onCancel}
                    >
                        Close
                    </button>
                ];
            } else if (this.changes) {
                if (this.hasChanges) {
                    let tabs = SECTIONS.filter(
                        section => this.changes[section].length > 0
                    ).map(section => (
                        <li
                            role="presentation"
                            key={section}
                            className="nav-item"
                        >
                            <a
                                href="#"
                                onClick={this.handleTabClick.bind(
                                    this,
                                    section
                                )}
                                className={
                                    "nav-link" +
                                    (this.activeTab === section
                                        ? " active"
                                        : "")
                                }
                            >
                                {humanize(section).toUpperCase()}
                                <span
                                    className={
                                        "ml-2 badge rounded-pill" +
                                        (this.activeTab === section
                                            ? " bg-dark"
                                            : " bg-secondary")
                                    }
                                >
                                    {this.changes[section].length}
                                </span>
                            </a>
                        </li>
                    ));

                    let tables = SECTIONS.map(section => {
                        if (this.changes[section].length === 0) {
                            return;
                        }

                        let thead;
                        if (section === "added") {
                            thead = (
                                <tr>
                                    <th className="col-8">
                                        <input
                                            ref={ref =>
                                                (this.addedSelectAllCheckbox =
                                                    ref!)
                                            }
                                            type="checkbox"
                                        />{" "}
                                        Command
                                    </th>
                                    <th className="col-4">To</th>
                                </tr>
                            );
                        } else if (section === "deleted") {
                            thead = (
                                <tr>
                                    <th className="col-8">
                                        <input
                                            ref={ref =>
                                                (this.deletedSelectAllCheckbox =
                                                    ref!)
                                            }
                                            type="checkbox"
                                        />{" "}
                                        Command
                                    </th>
                                    <th className="col-4">From</th>
                                </tr>
                            );
                        } else if (section === "updated") {
                            thead = (
                                <tr>
                                    <th className="col-8">
                                        <input
                                            ref={ref =>
                                                (this.updatedSelectAllCheckbox =
                                                    ref!)
                                            }
                                            type="checkbox"
                                        />{" "}
                                        Command
                                    </th>
                                    <th className="col-4">In</th>
                                </tr>
                            );
                        }

                        let tbody = (this.changes[section] as any).map(
                            (commandDefinition: CommandDefinition) => {
                                let checkbox = (
                                    <input
                                        type="checkbox"
                                        checked={this.isChangeSelected(
                                            section,
                                            commandDefinition
                                        )}
                                        onChange={this.handleSelectCommand.bind(
                                            this,
                                            section,
                                            commandDefinition
                                        )}
                                    />
                                );

                                return (
                                    <tr key={commandDefinition.command}>
                                        <td className="col-8">
                                            {checkbox}{" "}
                                            {commandDefinition.command}
                                        </td>
                                    </tr>
                                );
                            }
                        );

                        return (
                            <table
                                key={section}
                                style={{
                                    display:
                                        this.activeTab === section
                                            ? "block"
                                            : "none"
                                }}
                            >
                                <thead>{thead}</thead>
                                <tbody>{tbody}</tbody>
                            </table>
                        );
                    });

                    content = (
                        <form className="form-horizontal" onSubmit={this.onOk}>
                            <ul className="nav nav-pills">{tabs}</ul>
                            <div className="EezStudio_TablesDiv">{tables}</div>
                        </form>
                    );

                    buttons = [
                        <button
                            key="ok"
                            type="button"
                            className="btn btn-default"
                            onClick={this.onCancel}
                        >
                            Cancel
                        </button>,
                        <button
                            key="cancel"
                            type="button"
                            className="btn btn-primary"
                            onClick={this.onOk}
                            disabled={!this.hasSelectedChanges}
                        >
                            OK
                        </button>
                    ];
                } else {
                    content = (
                        <h4 style={{ textAlign: "center" }}>No changes!</h4>
                    );

                    buttons = [
                        <button
                            key="close"
                            type="button"
                            className="btn btn-primary"
                            onClick={this.onCancel}
                        >
                            Close
                        </button>
                    ];
                }
            } else {
                content = <Loader />;
            }

            let footer;
            if (buttons && buttons.length > 0) {
                footer = <div className="modal-footer">{buttons}</div>;
            }

            return (
                <div
                    ref={(ref: any) => (this.dialog = ref!)}
                    className={"modal fade EezStudio_ImportScpiDocDialogDiv"}
                    tabIndex={-1}
                    role="dialog"
                >
                    <div className="modal-lg modal-dialog" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="myModalLabel">
                                    Detected Instrument Command Changes
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close float-right"
                                    onClick={this.onCancel}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body">{content}</div>
                            {footer}
                        </div>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function showImportCommandsDocDialog(projectStore: ProjectStore) {
    let el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    root.render(
        <ProjectContext.Provider value={projectStore}>
            <ImportCommandsDocDialog
                onHidden={() => {
                    el.remove();
                }}
            />
        </ProjectContext.Provider>
    );
}
