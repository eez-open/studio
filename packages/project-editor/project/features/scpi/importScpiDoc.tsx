import React from "react";
import ReactDOM from "react-dom";
import { observable, computed, action, autorun, Lambda, toJS } from "mobx";
import { observer } from "mobx-react";

import { theme } from "eez-studio-ui/theme";
import { styled, ThemeProvider } from "eez-studio-ui/styled-components";

import { EezArrayObject } from "project-editor/core/metaData";
import {
    ProjectStore,
    UndoManager,
    loadObject,
    addObject,
    deleteObject,
    getProperty
} from "project-editor/core/store";

import { Loading } from "project-editor/components/Loading";

import { Scpi, ScpiCommand, ScpiSubsystem } from "project-editor/project/features/scpi/scpi";

const fs = EEZStudio.electron.remote.require("fs");

interface Command {
    name: string;
    helpLink?: string;
}

interface Subsystem {
    name: string;
    commands: EezArrayObject<Command>;
    helpLink?: string;
}

interface CommandDefinition {
    command: Command;
    subsystem: Subsystem;
}

interface MovedCommandDefinition extends CommandDefinition {
    toSubsystem: Subsystem;
}

interface Changes {
    subsystems: Subsystem[];
    added: CommandDefinition[];
    deleted: CommandDefinition[];
    moved: MovedCommandDefinition[];
}

function cleanUpScpiCommand(command: string) {
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
        //console.log(command);
        return false;
    }

    if (command.length < 4) {
        return undefined;
    }

    return command;
}

function getCommandFromSyntax(command: string) {
    command = command.trim();

    let i = command.indexOf(" ");
    if (i !== -1) {
        return command.slice(0, i);
    }

    return command;
}

function detectVersionOfScpiFileDoc(aElements: NodeListOf<Element>) {
    for (let i = 0; i < aElements.length; i++) {
        let bookmark = aElements[i].getAttribute("name");
        if (bookmark && (bookmark.startsWith("_scpi_subsys_") || bookmark.startsWith("_scpi_"))) {
            return 2;
        }
    }

    return 1;
}

function getSubsystemFromScpiFileVersion1Doc(file: string, aElements: NodeListOf<Element>) {
    let topicElement = aElements[0] && aElements[0].parentElement;
    if (topicElement != null) {
        let topic = topicElement.textContent;
        if (topic) {
            let subsystem: Subsystem = {
                name: topic,
                commands: new EezArrayObject<Command>(),
                helpLink: file
            };

            let commands = new Map<string, string>();

            for (let i = 1; i < aElements.length; i++) {
                let bookmark = aElements[i].getAttribute("name");
                if (bookmark) {
                    let commandElement = aElements[i].parentElement as HTMLElement;
                    if (commandElement) {
                        let command = commandElement.textContent;
                        if (command) {
                            let cleanedUpCommand = cleanUpScpiCommand(command);
                            if (cleanedUpCommand) {
                                let table = commandElement.nextElementSibling;
                                while (table) {
                                    if (table.tagName == "TABLE") {
                                        let tr = table.querySelector("tr:first-child");
                                        if (tr) {
                                            let td = tr.querySelector("td:first-child");
                                            if (
                                                td &&
                                                td.textContent &&
                                                td.textContent.indexOf("Syntax") != -1
                                            ) {
                                                let pList = tr.querySelectorAll(
                                                    "td:nth-child(2)>p"
                                                );
                                                let p = pList[0];
                                                if (p && p.textContent) {
                                                    commands.set(
                                                        getCommandFromSyntax(p.textContent),
                                                        bookmark
                                                    );

                                                    p = pList[1];
                                                    if (p && p.textContent) {
                                                        commands.set(
                                                            getCommandFromSyntax(p.textContent),
                                                            bookmark
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    }
                                    table = table.nextElementSibling;
                                }
                            }
                        }
                    }
                }
            }

            commands.forEach((bookmark, command) => {
                subsystem.commands._array.push({
                    name: command,
                    helpLink: file + "#" + bookmark
                });
            });

            return [subsystem];
        }
    }

    return [];
}

function getSubsystemFromScpiFileVersion2Doc(file: string, aElements: NodeListOf<Element>) {
    let subsystems: Subsystem[] = [];

    let subsystem: Subsystem | undefined;
    let commandBookmark: string | undefined;

    for (let i = 0; i < aElements.length; i++) {
        let bookmark = aElements[i].getAttribute("name");
        if (bookmark) {
            let parentElement = aElements[i].parentElement;
            if (parentElement != null) {
                let text = parentElement.textContent;
                if (text) {
                    if (bookmark.startsWith("_scpi_subsys_")) {
                        subsystem = {
                            name: text,
                            commands: new EezArrayObject<Command>(),
                            helpLink: file
                        };
                        subsystems.push(subsystem);
                    } else if (subsystem && bookmark.startsWith("_scpi_")) {
                        subsystem.commands._array.push({
                            name: getCommandFromSyntax(text),
                            helpLink: file + "#" + (commandBookmark || bookmark)
                        });
                    } else {
                        commandBookmark = bookmark;
                    }
                }
            }
        }
    }

    return subsystems;
}

function getSubsystemFromScpiFileDoc(file: string, aElements: NodeListOf<Element>) {
    let version = detectVersionOfScpiFileDoc(aElements);
    if (version === 1) {
        return getSubsystemFromScpiFileVersion1Doc(file, aElements);
    } else if (version === 2) {
        return getSubsystemFromScpiFileVersion2Doc(file, aElements);
    } else {
        return [];
    }
}

function getCommandsFromScpiDoc() {
    return new Promise<Subsystem[]>((resolve, reject) => {
        if (ProjectStore.project.settings.general.scpiDocFolder === undefined) {
            reject("SCPI help folder is not defined");
            return;
        }

        let scpiHelpFolderPath = ProjectStore.getAbsoluteFilePath(
            ProjectStore.project.settings.general.scpiDocFolder
        );

        fs.exists(scpiHelpFolderPath, (exists: boolean) => {
            if (!exists) {
                reject(`SCPI help folder "${scpiHelpFolderPath}" doesn't exists.`);
            } else {
                fs.readdir(scpiHelpFolderPath, (err: any, files: string[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    files = files.filter(file => file.endsWith("html"));

                    let promises: Promise<Subsystem[]>[] = files.map(file => {
                        return new Promise<Subsystem[]>((resolve, reject) => {
                            fs.readFile(
                                scpiHelpFolderPath + "/" + file,
                                "utf-8",
                                (err: any, data: string) => {
                                    if (!err) {
                                        let element = document.createElement("div");
                                        element.innerHTML = data;
                                        let aElements = element.querySelectorAll("A[name]");
                                        let subsystems = getSubsystemFromScpiFileDoc(
                                            file,
                                            aElements
                                        );
                                        resolve(subsystems);
                                    } else {
                                        resolve([]);
                                    }
                                }
                            );
                        });
                    });

                    Promise.all(promises)
                        .then(results => {
                            let allSubsystems: Subsystem[] = [];

                            results.forEach(subsystems => {
                                if (subsystems) {
                                    allSubsystems = allSubsystems.concat(subsystems);
                                }
                            });

                            resolve(allSubsystems);
                        })
                        .catch(err => reject(err));
                });
            }
        });
    });
}

function compareCommandDefinitions(a: CommandDefinition, b: CommandDefinition) {
    let c1 = a.command.name.toUpperCase();
    let c2 = b.command.name.toUpperCase();
    return c1 < c2 ? -1 : c1 > c2 ? 1 : 0;
}

function findCommandInSubsystems(subsystems: Subsystem[], commandName: string) {
    for (const subsystem of subsystems) {
        for (const command of subsystem.commands._array) {
            if (command.name === commandName) {
                return {
                    subsystem: subsystem,
                    command: command
                };
            }
        }
    }
    return undefined;
}

function findMissingCommands(subsystems1: Subsystem[], subsystems2: Subsystem[]) {
    let missingCommands: CommandDefinition[] = [];

    subsystems1.forEach(subsystem => {
        subsystem.commands._array.forEach(command => {
            if (!findCommandInSubsystems(subsystems2, command.name)) {
                missingCommands.push({
                    command: command,
                    subsystem: subsystem
                });
            }
        });
    });

    return missingCommands.sort(compareCommandDefinitions);
}

function getChanges() {
    return new Promise<Changes>((resolve, reject) => {
        getCommandsFromScpiDoc()
            .then(subsystems => {
                console.log(subsystems);

                let existingSubsystems = (getProperty(
                    ProjectStore.project,
                    "scpi"
                ) as Scpi).subsystems;

                // added
                let added = findMissingCommands(subsystems, existingSubsystems._array);

                // deleted
                let deleted = findMissingCommands(existingSubsystems._array, subsystems);

                // moved
                let moved: MovedCommandDefinition[] = [];
                subsystems.forEach(subsystem => {
                    subsystem.commands._array.forEach(command => {
                        let result = findCommandInSubsystems(
                            existingSubsystems._array,
                            command.name
                        );
                        if (result && result.subsystem.name !== subsystem.name) {
                            moved.push({
                                command: command,
                                subsystem: result.subsystem,
                                toSubsystem: subsystem
                            });
                        }
                    });
                });
                moved = moved.sort(compareCommandDefinitions);

                resolve({
                    subsystems: subsystems,
                    added: added,
                    deleted: deleted,
                    moved: moved
                });
            })
            .catch(reject);
    });
}

const ImportScpiDocDialogDiv = styled.div`
    * {
        user-select: auto;
    }

    table {
        margin-bottom: 0;
        width: 100%;
        border: 1px solid #ddd;
    }

    thead {
        display: block;
        width: 100%;
    }

    th {
        background-color: #eee;
        height: 32px;
        padding-top: 4px;
        border-bottom: 1px solid #ddd;
    }

    thead,
    tbody,
    tr,
    td,
    th {
        display: block;
    }

    tbody {
        display: block;
        width: 100%;
        max-height: 200px;
        overflow-y: auto;
        overflow-x: hidden;
    }

    tr {
        clear: both;
    }

    tbody {
        td {
            float: left;

            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }

    thead {
        th {
            float: left;
        }
    }
`;

const TablesDiv = styled.div`
    padding-top: 15px;
`;

type Section = "added" | "deleted" | "moved";

const SECTIONS: Section[] = ["added", "deleted", "moved"];

@observer
export class ImportScpiDocDialog extends React.Component<
    {
        onHidden: () => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);
    }

    dialog: HTMLDivElement;
    addedSelectAllCheckbox: HTMLInputElement;
    deletedSelectAllCheckbox: HTMLInputElement;
    movedSelectAllCheckbox: HTMLInputElement;

    @observable
    changes: Changes;
    @observable
    selectedChanges: Changes = {
        subsystems: [],
        added: [],
        deleted: [],
        moved: []
    };
    @observable
    error: any;
    @observable
    activeTab: Section;
    selectAllCheckboxDisposers: {
        added?: Lambda;
        deleted?: Lambda;
        moved?: Lambda;
    } = {};

    @computed
    get hasChanges() {
        return (
            this.changes.added.length > 0 ||
            this.changes.deleted.length > 0 ||
            this.changes.moved.length > 0
        );
    }

    @computed
    get hasSelectedChanges() {
        return (
            this.selectedChanges.added.length > 0 ||
            this.selectedChanges.deleted.length > 0 ||
            this.selectedChanges.moved.length > 0
        );
    }

    componentDidMount() {
        $(this.dialog).on("shown.bs.modal", () => {
            $(this.dialog)
                .find("input")
                .select();
        });

        $(this.dialog).on("hidden.bs.modal", () => {
            this.props.onHidden();
        });

        $(this.dialog).modal({
            backdrop: "static"
        });

        getChanges()
            .then(
                action((changes: Changes) => {
                    this.changes = changes;

                    if (changes.added.length > 0) {
                        this.activeTab = "added";
                    } else if (changes.deleted.length > 0) {
                        this.activeTab = "deleted";
                    } else if (changes.moved.length > 0) {
                        this.activeTab = "moved";
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

    onOk(event: any) {
        event.preventDefault();
        $(this.dialog).modal("hide");

        UndoManager.setCombineCommands(true);

        let existingSubsystems = (getProperty(ProjectStore.project, "scpi") as Scpi)
            .subsystems;

        let getOrAddSubsystem = (subsystem: Subsystem) => {
            let existingSubsystem = existingSubsystems._array.find(
                existingSubsystem => existingSubsystem.name === subsystem.name
            );
            if (existingSubsystem) {
                return existingSubsystem;
            }

            return addObject(
                existingSubsystems,
                loadObject(
                    existingSubsystems,
                    {
                        name: subsystem.name,
                        helpLink: subsystem.helpLink,
                        commands: []
                    },
                    ScpiSubsystem.classInfo
                )
            );
        };

        this.changes.subsystems.forEach(subsystem => getOrAddSubsystem(subsystem));

        this.selectedChanges.added.forEach(commandDefinition => {
            let subsystem = getOrAddSubsystem(commandDefinition.subsystem);

            addObject(
                getProperty(subsystem, "commands"),
                loadObject(
                    getProperty(subsystem, "commands"),
                    {
                        name: commandDefinition.command.name,
                        helpLink: commandDefinition.command.helpLink
                    },
                    ScpiCommand.classInfo
                )
            );
        });

        this.selectedChanges.deleted.forEach(commandDefinition => {
            let result = findCommandInSubsystems(
                existingSubsystems._array,
                commandDefinition.command.name
            );
            if (result) {
                deleteObject(result.command);
            }
        });

        this.selectedChanges.moved.forEach(commandDefinition => {
            let result = findCommandInSubsystems(
                existingSubsystems._array,
                commandDefinition.command.name
            );
            if (result) {
                let command = result.command as ScpiCommand;
                deleteObject(command);

                command.helpLink = commandDefinition.command.helpLink;

                let subsystem = getOrAddSubsystem(commandDefinition.toSubsystem);

                addObject(getProperty(subsystem, "commands"), command);
            }
        });

        UndoManager.setCombineCommands(false);

        console.log(toJS(this.selectedChanges));
    }

    onCancel() {
        $(this.dialog).modal("hide");
    }

    @action
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
                checkbox = this.movedSelectAllCheckbox;
            }

            if (!checkbox) {
                return;
            }

            this.selectAllCheckboxDisposers[section] = autorun(() => {
                if (this.selectedChanges[section].length == 0) {
                    checkbox.indeterminate = false;
                    checkbox.checked = false;
                } else if (this.selectedChanges[section].length == this.changes[section].length) {
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
                        this.selectedChanges[section] = this.changes[section].slice();
                    } else {
                        this.selectedChanges[section] = [];
                    }
                })
            );
        });
    }

    isCommandSelected(section: Section, commandDefinition: CommandDefinition) {
        let commandDefinitions: any = this.selectedChanges[section];
        return commandDefinitions.indexOf(commandDefinition) !== -1;
    }

    @action
    handleSelectCommand(section: Section, commandDefinition: CommandDefinition, event: any) {
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
                    onClick={this.onCancel.bind(this)}
                >
                    Close
                </button>
            ];
        } else if (this.changes) {
            if (this.hasChanges) {
                let tabs = SECTIONS.filter(section => this.changes[section].length > 0).map(
                    section => (
                        <li role="presentation" key={section} className="nav-item">
                            <a
                                href="#"
                                onClick={this.handleTabClick.bind(this, section)}
                                className={
                                    "nav-link" + (this.activeTab === section ? " active" : "")
                                }
                            >
                                {section.toUpperCase()} {this.activeTab === section && "COMMANDS"}{" "}
                                <span
                                    className={
                                        "badge badge-pills" +
                                        (this.activeTab === section
                                            ? " badge-light"
                                            : " badge-dark")
                                    }
                                >
                                    {this.changes[section].length}
                                </span>
                            </a>
                        </li>
                    )
                );

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
                                        ref={ref => (this.addedSelectAllCheckbox = ref!)}
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
                                        ref={ref => (this.deletedSelectAllCheckbox = ref!)}
                                        type="checkbox"
                                    />{" "}
                                    Command
                                </th>
                                <th className="col-4">From</th>
                            </tr>
                        );
                    } else {
                        thead = (
                            <tr>
                                <th className="col-6">
                                    <input
                                        ref={ref => (this.movedSelectAllCheckbox = ref!)}
                                        type="checkbox"
                                    />{" "}
                                    Command
                                </th>
                                <th className="col-3">From</th>
                                <th className="col-3">To</th>
                            </tr>
                        );
                    }

                    let tbody = (this.changes[section] as any).map(
                        (commandDefinition: CommandDefinition) => {
                            let checkbox = (
                                <input
                                    type="checkbox"
                                    checked={this.isCommandSelected(section, commandDefinition)}
                                    onChange={this.handleSelectCommand.bind(
                                        this,
                                        section,
                                        commandDefinition
                                    )}
                                />
                            );

                            if (section === "added" || section === "deleted") {
                                return (
                                    <tr key={commandDefinition.command.name}>
                                        <td className="col-8">
                                            {checkbox} {commandDefinition.command.name}
                                        </td>
                                        <td className="col-4">
                                            {commandDefinition.subsystem.name}
                                        </td>
                                    </tr>
                                );
                            } else {
                                return (
                                    <tr key={commandDefinition.command.name}>
                                        <td className="col-6">
                                            {checkbox} {commandDefinition.command.name}
                                        </td>
                                        <td className="col-3">
                                            {commandDefinition.subsystem.name}
                                        </td>
                                        <td className="col-3">
                                            {
                                                (commandDefinition as MovedCommandDefinition)
                                                    .toSubsystem.name
                                            }
                                        </td>
                                    </tr>
                                );
                            }
                        }
                    );

                    return (
                        <table
                            key={section}
                            style={{ display: this.activeTab === section ? "block" : "none" }}
                        >
                            <thead>{thead}</thead>
                            <tbody>{tbody}</tbody>
                        </table>
                    );
                });

                content = (
                    <form className="form-horizontal" onSubmit={this.onOk.bind(this)}>
                        <ul className="nav nav-pills">{tabs}</ul>
                        <TablesDiv>{tables}</TablesDiv>
                    </form>
                );

                buttons = [
                    <button
                        key="ok"
                        type="button"
                        className="btn btn-default"
                        onClick={this.onCancel.bind(this)}
                    >
                        Cancel
                    </button>,
                    <button
                        key="cancel"
                        type="button"
                        className="btn btn-primary"
                        onClick={this.onOk.bind(this)}
                        disabled={!this.hasSelectedChanges}
                    >
                        OK
                    </button>
                ];
            } else {
                content = <h4 style={{ textAlign: "center" }}>No changes!</h4>;

                buttons = [
                    <button
                        key="close"
                        type="button"
                        className="btn btn-primary"
                        onClick={this.onCancel.bind(this)}
                    >
                        Close
                    </button>
                ];
            }
        } else {
            content = <Loading />;
        }

        let footer;
        if (buttons && buttons.length > 0) {
            footer = <div className="modal-footer">{buttons}</div>;
        }

        return (
            <ImportScpiDocDialogDiv
                innerRef={ref => (this.dialog = ref!)}
                className={"modal fade"}
                tabIndex={-1}
                role="dialog"
            >
                <div className="modal-lg modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="myModalLabel">
                                Detected SCPI Command Changes
                            </h5>
                            <button
                                type="button"
                                className="close float-right"
                                onClick={this.onCancel.bind(this)}
                                aria-label="Close"
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div className="modal-body">{content}</div>
                        {footer}
                    </div>
                </div>
            </ImportScpiDocDialogDiv>
        );
    }
}

export function showImportScpiDocDialog() {
    let el = document.createElement("div");
    document.body.appendChild(el);
    ReactDOM.render(
        <ThemeProvider theme={theme}>
            <ImportScpiDocDialog onHidden={() => el.remove()} />
        </ThemeProvider>,
        el
    );
}
