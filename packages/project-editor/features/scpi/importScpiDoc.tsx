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
    toJS,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import {
    humanize,
    camelize,
    capitalize,
    stringCompare
} from "eez-studio-shared/string";

import { Loader } from "eez-studio-ui/loader";

import type { IParameter, IParameterType, IEnum } from "instrument/scpi";

import { createObject, objectToJS, ProjectStore } from "project-editor/store";
import { ScpiCommand, ScpiSubsystem } from "project-editor/features/scpi/scpi";
import { ScpiEnum } from "project-editor/features/scpi/enum";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

interface Command {
    name: string;
    helpLink?: string;
    parameters: IParameter[];
}

interface Subsystem {
    name: string;
    commands: Command[];
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
    updated: CommandDefinition[];
    newEnums: IEnum[];
}

class FindChanges {
    constructor(
        private projectStore: ProjectStore,
        private existingEnums: ScpiEnum[]
    ) {}

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

    getParameterTypeAndRange(name: string, table: Element) {
        const elements = table.querySelectorAll("tr>td>p");
        for (let i = 0; i < elements.length; ++i) {
            if (
                elements[i].textContent &&
                elements[i].textContent!.trim() === name
            ) {
                let type;
                let range;

                let sibling = elements[i].parentElement!.nextElementSibling;
                if (sibling) {
                    type = sibling.textContent;

                    sibling = sibling.nextElementSibling;
                    if (sibling) {
                        range = sibling.textContent;
                    }
                }

                return {
                    type,
                    range
                };
            }
        }

        return {
            type: undefined,
            range: undefined
        };
    }

    newEnums: IEnum[] = [];

    enumExists(name: string) {
        for (let i = 0; i < this.existingEnums.length; ++i) {
            if (this.existingEnums[i].name === name) {
                return true;
            }
        }

        for (let i = 0; i < this.newEnums.length; ++i) {
            if (this.newEnums[i].name === name) {
                return true;
            }
        }

        return false;
    }

    getUniqueEnumName(suggestedEnumName: string) {
        let name = suggestedEnumName;

        let suffix = 1;
        while (this.enumExists(name)) {
            name = suggestedEnumName + suffix;
            ++suffix;
        }

        return name;
    }

    findEnum(suggestedEnumName: string, members: string): string {
        // find in existing enums
        for (let i = 0; i < this.existingEnums.length; ++i) {
            if (
                this.existingEnums[i].members
                    .map(member => member.name)
                    .join("|") === members
            ) {
                return this.existingEnums[i].name;
            }
        }

        // find in new enums
        for (let i = 0; i < this.newEnums.length; ++i) {
            if (
                this.newEnums[i].members
                    .map(member => member.name)
                    .join("|") === members
            ) {
                return this.newEnums[i].name;
            }
        }

        // create a new enum
        const newEnum = {
            name: this.getUniqueEnumName(suggestedEnumName),
            members: members.split("|").map((member, i) => ({
                name: member,
                value: ""
            }))
        };

        this.newEnums.push(newEnum);

        return newEnum.name;
    }

    extractEnumFromRange(suggestedEnumName: string, range: string) {
        // join lines and remove whitespaces
        range = range.split("\n").join("");

        // remove whitespaces between |
        range = range
            .split("|")
            .map(x => x.trim())
            .join("|");

        // We are handling all kind of funny cases like:
        // "0 – 9999999|INFinite" => ["INFinite"]
        // "0 to MAXimum, MIN|DEF|MAX|UP|DOWN" => ["MIN", "DEF", "MAX", "UP", "DOWN"]
        // "MIN|MID|MAX (see also Section 8.1)" => ["MIN", "MID", "MAX"]
        // "0.5, 5, MIN|MAX|DEFault" => ["MIN", "MAX", "DEFault"]
        // etc
        const matches = range.match(/(([A-Za-z0-9]*)\|?)+/g);
        if (!matches) {
            return undefined;
        }

        // find longest match
        let result = matches[0];
        for (let i = 1; i < matches.length; ++i) {
            if (matches[i].length > result.length) {
                result = matches[i];
            }
        }

        // trim and remove empty members
        return this.findEnum(
            suggestedEnumName,
            result
                .split("|")
                .map(x => x.trim())
                .filter(x => !!x)
                .join("|")
        );
    }

    getCommandParameters(commandNameAndParams: string, table: Element) {
        // Find parameters in p.textContent.
        // Look in surounding table to get parameters type and range.

        // We are handling all these cases:
        // {<param>} (this is mandatory param)
        // [<param>] (this is optional param)
        // {<param1>}, {<param2>}, {<param3>}
        // {<param1>} [, <param2>]
        // {<param1>} [, <param2> [, <param3>]]
        // {<param1>} [, ...] ("..." means repetition of parameter before is possible )

        if (!table) {
            return [];
        }

        commandNameAndParams = commandNameAndParams.trim();

        let i = commandNameAndParams.trim().indexOf(" ");
        if (i === -1) {
            // no params
            return [];
        }

        let nextIsOptional = false;

        let params: IParameter[] = commandNameAndParams
            .substr(i)
            .trim()
            .split(",")
            .map(name => {
                name = name.trim();

                let isOptional = nextIsOptional === true;

                // remove [ and ] at the beginning
                while (name.startsWith("[") || name.startsWith("]")) {
                    name = name.substr(1, name.length - 1).trim();
                    isOptional = true;
                }

                // remove [ and ] at the end
                while (name.endsWith("[") || name.endsWith("]")) {
                    name = name.substr(0, name.length - 1).trim();
                    nextIsOptional = true;
                }

                if (name.startsWith("{")) {
                    isOptional = false;
                    if (!name.endsWith("}")) {
                        console.error(
                            "Invalid params spec",
                            commandNameAndParams
                        );
                        return undefined;
                    }
                    name = name.substr(1, name.length - 2);
                }

                let types: IParameterType[] = [];

                if (name === "...") {
                    return undefined;
                }

                if (!name.startsWith("<") || !name.endsWith(">")) {
                    console.error("Invalid params spec", commandNameAndParams);
                    return undefined;
                }

                let { type, range } = this.getParameterTypeAndRange(
                    name,
                    table
                );

                name = name.substr(1, name.length - 2);

                if (type != undefined && range != undefined) {
                    type.trim()
                        .toLowerCase()
                        .split("|")
                        .forEach(type => {
                            if (
                                type === "nr1" ||
                                type === "nr2" ||
                                type === "nr3" ||
                                type === "boolean"
                            ) {
                                types.push({
                                    type
                                });
                            } else if (type === "integer") {
                                types.push({
                                    type: "nr1"
                                });
                            } else if (type === "real") {
                                types.push({
                                    type: "nr3"
                                });
                            } else if (type === "bool") {
                                types.push({
                                    type: "boolean"
                                });
                            } else if (
                                type === "quoted string" ||
                                type === "ascii string"
                            ) {
                                types.push({
                                    type: "quoted-string"
                                });
                            } else if (type === "data block") {
                                types.push({
                                    type: "data-block"
                                });
                            } else if (type === "channellist") {
                                types.push({
                                    type: "channel-list"
                                });
                            } else if (type === "channel") {
                                types.push({
                                    type: "discrete",
                                    enumeration: "Channel"
                                });
                            } else if (type === "discrete") {
                                types.push({
                                    type: "discrete",
                                    enumeration: this.extractEnumFromRange(
                                        capitalize(camelize(name)),
                                        range!
                                    )
                                });
                            } else {
                                console.error(
                                    `unknown type "${type}" for parameter "${name}" in "${commandNameAndParams}"`
                                );
                            }
                        });
                } else {
                    console.error(
                        `type or range undefined for parameter "${name}" in "${commandNameAndParams}"`
                    );
                }

                return { name, type: types, isOptional };
            })
            .filter(param => !!param) as IParameter[];

        // some checks, only purpose for now is to emit some errors in console
        let firstOptional = false;
        for (let i = 0; i < params.length; ++i) {
            if (i < params.length - 1 && params[i].name === "...") {
                console.error(
                    'Type "..." should be at the end',
                    commandNameAndParams
                );
            }
            if (firstOptional) {
                if (!params[i].isOptional) {
                    console.error(
                        "All optional should be at the end",
                        commandNameAndParams
                    );
                }
            } else {
                if (params[i].isOptional) {
                    firstOptional = true;
                }
            }
        }

        return params;
    }

    detectVersionOfScpiFileDoc(anchorElements: NodeListOf<Element>) {
        for (let i = 0; i < anchorElements.length; i++) {
            let bookmark = anchorElements[i].getAttribute("name");
            if (
                bookmark &&
                (bookmark.startsWith("_scpi_subsys_") ||
                    bookmark.startsWith("_scpi_"))
            ) {
                return 2;
            }
        }

        return 1;
    }

    addCommand(
        commands: {
            bookmark: string;
            name: string;
            parameters: IParameter[];
        }[],
        bookmark: string,
        textContent: string,
        table: Element
    ) {
        const name = this.getCommandFromSyntax(textContent);

        const parameters = this.getCommandParameters(textContent, table);

        const existingCommand = commands.find(
            existingCommand => existingCommand.name === name
        );
        if (!existingCommand) {
            commands.push({
                bookmark,
                name,
                parameters
            });
        } else {
            if (parameters.length > existingCommand.parameters.length) {
                existingCommand.parameters = parameters;
            }
        }
    }

    getSubsystemFromScpiFileVersion1Doc(
        file: string,
        anchorElements: NodeListOf<Element>
    ) {
        let topicElement = anchorElements[0] && anchorElements[0].parentElement;
        if (topicElement != null) {
            let topic = topicElement.textContent;
            if (topic) {
                let subsystem: Subsystem = {
                    name: topic,
                    commands: [],
                    helpLink: file
                };

                let commands: {
                    bookmark: string;
                    name: string;
                    parameters: IParameter[];
                }[] = [];

                for (let i = 1; i < anchorElements.length; i++) {
                    let bookmark = anchorElements[i].getAttribute("name");
                    if (bookmark) {
                        let commandElement = anchorElements[i]
                            .parentElement as HTMLElement;
                        if (commandElement) {
                            let command = commandElement.textContent;
                            if (command) {
                                let cleanedUpCommand =
                                    this.cleanUpScpiCommand(command);
                                if (cleanedUpCommand) {
                                    let table =
                                        commandElement.nextElementSibling;
                                    while (table) {
                                        if (table.tagName == "TABLE") {
                                            let tr =
                                                table.querySelector(
                                                    "tr:first-child"
                                                );
                                            if (tr) {
                                                let td =
                                                    tr.querySelector(
                                                        "td:first-child"
                                                    );
                                                if (
                                                    td &&
                                                    td.textContent &&
                                                    td.textContent.indexOf(
                                                        "Syntax"
                                                    ) != -1
                                                ) {
                                                    let pList =
                                                        tr.querySelectorAll(
                                                            "td:nth-child(2)>p"
                                                        );
                                                    let p = pList[0];
                                                    if (p && p.textContent) {
                                                        this.addCommand(
                                                            commands,
                                                            bookmark,
                                                            p.textContent,
                                                            table
                                                        );

                                                        p = pList[1];
                                                        if (
                                                            p &&
                                                            p.textContent
                                                        ) {
                                                            this.addCommand(
                                                                commands,
                                                                bookmark,
                                                                p.textContent,
                                                                table
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

                commands.forEach(({ bookmark, name, parameters }) => {
                    subsystem.commands.push({
                        name,
                        helpLink: file + "#" + bookmark,
                        parameters
                    });
                });

                return [subsystem];
            }
        }

        return [];
    }

    getSubsystemFromScpiFileVersion2Doc(
        file: string,
        anchorElements: NodeListOf<Element>
    ) {
        let subsystems: Subsystem[] = [];

        let subsystem: Subsystem | undefined;
        let commandBookmark: string | undefined;

        for (let i = 0; i < anchorElements.length; i++) {
            let bookmark = anchorElements[i].getAttribute("name");
            if (bookmark) {
                let parentElement = anchorElements[i].parentElement;
                if (parentElement != null) {
                    let text = parentElement.textContent;
                    if (text) {
                        if (bookmark.startsWith("_scpi_subsys_")) {
                            subsystem = {
                                name: text,
                                commands: [],
                                helpLink: file
                            };
                            subsystems.push(subsystem);
                        } else if (subsystem && bookmark.startsWith("_scpi_")) {
                            const parameters = this.getCommandParameters(
                                text,
                                $(parentElement).parents("table")[0]
                            );

                            subsystem.commands.push({
                                name: this.getCommandFromSyntax(text),
                                helpLink:
                                    file + "#" + (commandBookmark || bookmark),
                                parameters
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

    getSubsystemFromScpiFileDoc(
        file: string,
        anchorElements: NodeListOf<Element>
    ) {
        let version = this.detectVersionOfScpiFileDoc(anchorElements);
        if (version === 1) {
            return this.getSubsystemFromScpiFileVersion1Doc(
                file,
                anchorElements
            );
        } else if (version === 2) {
            return this.getSubsystemFromScpiFileVersion2Doc(
                file,
                anchorElements
            );
        } else {
            return [];
        }
    }

    getCommandsFromScpiDoc() {
        return new Promise<Subsystem[]>((resolve, reject) => {
            if (
                this.projectStore.project.settings.general.commandsDocFolder ===
                undefined
            ) {
                reject("SCPI help folder is not defined");
                return;
            }

            let scpiHelpFolderPath = this.projectStore.getAbsoluteFilePath(
                this.projectStore.project.settings.general.commandsDocFolder
            );

            fs.exists(scpiHelpFolderPath, (exists: boolean) => {
                if (!exists) {
                    reject(
                        `SCPI help folder "${scpiHelpFolderPath}" doesn't exists.`
                    );
                } else {
                    fs.readdir(
                        scpiHelpFolderPath,
                        (err: any, files: string[]) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            files = files.filter(file => file.endsWith("html"));

                            let promises: Promise<Subsystem[]>[] = files.map(
                                file => {
                                    return new Promise<Subsystem[]>(
                                        (resolve, reject) => {
                                            fs.readFile(
                                                scpiHelpFolderPath + "/" + file,
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
                                                        let subsystems =
                                                            this.getSubsystemFromScpiFileDoc(
                                                                file,
                                                                anchorElements
                                                            );
                                                        resolve(subsystems);
                                                    } else {
                                                        resolve([]);
                                                    }
                                                }
                                            );
                                        }
                                    );
                                }
                            );

                            Promise.all(promises)
                                .then(results => {
                                    let allSubsystems: Subsystem[] = [];

                                    results.forEach(subsystems => {
                                        if (subsystems) {
                                            allSubsystems =
                                                allSubsystems.concat(
                                                    subsystems
                                                );
                                        }
                                    });

                                    resolve(allSubsystems);
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
        let c1 = a.command.name.toUpperCase();
        let c2 = b.command.name.toUpperCase();
        return c1 < c2 ? -1 : c1 > c2 ? 1 : 0;
    }

    findCommandInSubsystems(subsystems: Subsystem[], commandName: string) {
        for (const subsystem of subsystems) {
            for (const command of subsystem.commands) {
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

    findMissingCommands(subsystems1: Subsystem[], subsystems2: Subsystem[]) {
        let missingCommands: CommandDefinition[] = [];

        subsystems1.forEach(subsystem => {
            subsystem.commands.forEach(command => {
                if (!this.findCommandInSubsystems(subsystems2, command.name)) {
                    missingCommands.push({
                        command: command,
                        subsystem: subsystem
                    });
                }
            });
        });

        return missingCommands.sort(FindChanges.compareCommandDefinitions);
    }

    compareParameterTypes(types1: IParameterType[], types2: IParameterType[]) {
        const sortedTypes1: IParameterType[] = types1
            .slice()
            .sort((a, b) => stringCompare(a.type, b.type));

        const sortedTypes2: IParameterType[] = types2
            .slice()
            .sort((a, b) => stringCompare(a.type, b.type));

        for (let i = 0; i < sortedTypes2.length; ++i) {
            if (sortedTypes2[i].type === "any") {
                return true;
            }
        }

        if (sortedTypes1.length !== sortedTypes2.length) {
            return false;
        }

        for (let i = 0; i < sortedTypes1.length; ++i) {
            const type1 = sortedTypes1[i];
            const type2 = sortedTypes2[i];

            if (type1.type !== type2.type) {
                return false;
            }

            if (type1.type === "discrete") {
                if (
                    !!type1.enumeration &&
                    type1.enumeration !== type2.enumeration
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    compareParameters(parameters1: IParameter[], parameters2: IParameter[]) {
        const sortedParameters1: IParameter[] = parameters1
            .slice()
            .sort((a: IParameter, b: IParameter) =>
                stringCompare(a.name, b.name)
            );

        const sortedParameters2: IParameter[] = parameters2
            .slice()
            .sort((a: IParameter, b: IParameter) =>
                stringCompare(a.name, b.name)
            );

        if (sortedParameters1.length !== sortedParameters2.length) {
            return false;
        }

        for (let i = 0; i < sortedParameters1.length; ++i) {
            const param1 = sortedParameters1[i];
            const param2 = sortedParameters2[i];

            if (param1.name !== param2.name) {
                return false;
            }

            if (param1.description !== param2.description) {
                return false;
            }

            if (param1.isOptional !== param2.isOptional) {
                return false;
            }

            if (!this.compareParameterTypes(param1.type, param2.type)) {
                return false;
            }
        }

        return true;
    }

    getChanges() {
        return new Promise<Changes>((resolve, reject) => {
            this.getCommandsFromScpiDoc()
                .then(subsystems => {
                    let existingSubsystems = objectToJS(
                        this.projectStore.project.scpi.subsystems
                    );

                    // added
                    let added = this.findMissingCommands(
                        subsystems,
                        existingSubsystems
                    );

                    // deleted
                    let deleted = this.findMissingCommands(
                        existingSubsystems,
                        subsystems
                    );

                    // moved
                    let moved: MovedCommandDefinition[] = [];
                    subsystems.forEach(subsystem => {
                        subsystem.commands.forEach(command => {
                            let result = this.findCommandInSubsystems(
                                existingSubsystems,
                                command.name
                            );
                            if (
                                result &&
                                result.subsystem.name !== subsystem.name
                            ) {
                                moved.push({
                                    command: command,
                                    subsystem: result.subsystem,
                                    toSubsystem: subsystem
                                });
                            }
                        });
                    });
                    moved = moved.sort(FindChanges.compareCommandDefinitions);

                    // updated
                    let updated: CommandDefinition[] = [];
                    subsystems.forEach(subsystem => {
                        subsystem.commands.forEach(command => {
                            let existingCommand = this.findCommandInSubsystems(
                                existingSubsystems,
                                command.name
                            );
                            if (
                                existingCommand &&
                                existingCommand.subsystem.name ===
                                    subsystem.name &&
                                (!existingCommand.command.helpLink ||
                                    !subsystem.helpLink ||
                                    (existingCommand.command.helpLink &&
                                        subsystem.helpLink &&
                                        !existingCommand.command.helpLink.startsWith(
                                            subsystem.helpLink
                                        )) ||
                                    !this.compareParameters(
                                        command.parameters,
                                        existingCommand.command.parameters
                                    ))
                            ) {
                                updated.push({
                                    command: command,
                                    subsystem
                                });
                            }
                        });
                    });

                    resolve({
                        subsystems,
                        added,
                        deleted,
                        moved,
                        updated,
                        newEnums: this.newEnums
                    });
                })
                .catch(reject);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

function findCommandInScpiSubsystems(
    subsystems: ScpiSubsystem[],
    commandName: string
) {
    for (const subsystem of subsystems) {
        for (const command of subsystem.commands) {
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

////////////////////////////////////////////////////////////////////////////////

type Section = "added" | "deleted" | "moved" | "updated" | "newEnums";

const SECTIONS: Section[] = [
    "added",
    "deleted",
    "moved",
    "updated",
    "newEnums"
];

export const ImportScpiDocDialog = observer(
    class ImportScpiDocDialog extends React.Component<{
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
        movedSelectAllCheckbox: HTMLInputElement;
        updatedSelectAllCheckbox: HTMLInputElement;
        newEnumsSelectAllCheckbox: HTMLInputElement;

        changes: Changes;
        selectedChanges: Changes = {
            subsystems: [],
            added: [],
            deleted: [],
            moved: [],
            updated: [],
            newEnums: []
        };
        error: any;
        activeTab: Section;
        selectAllCheckboxDisposers: {
            added?: Lambda;
            deleted?: Lambda;
            moved?: Lambda;
            updated?: Lambda;
            newEnums?: Lambda;
        } = {};

        get hasChanges() {
            return (
                this.changes.added.length > 0 ||
                this.changes.deleted.length > 0 ||
                this.changes.moved.length > 0 ||
                this.changes.updated.length > 0 ||
                this.changes.newEnums.length > 0
            );
        }

        get hasSelectedChanges() {
            return (
                this.selectedChanges.added.length > 0 ||
                this.selectedChanges.deleted.length > 0 ||
                this.selectedChanges.moved.length > 0 ||
                this.selectedChanges.updated.length > 0 ||
                this.selectedChanges.newEnums.length > 0
            );
        }

        componentDidMount() {
            $(this.dialog).on("hidden.bs.modal", () => {
                this.props.onHidden();
            });

            this.modal = new bootstrap.Modal(this.dialog);
            this.modal.show();

            const scpi = this.context.project.scpi;

            const findChanges = new FindChanges(this.context, scpi.enums);

            findChanges
                .getChanges()
                .then(
                    action((changes: Changes) => {
                        this.changes = changes;

                        if (changes.added.length > 0) {
                            this.activeTab = "added";
                        } else if (changes.deleted.length > 0) {
                            this.activeTab = "deleted";
                        } else if (changes.moved.length > 0) {
                            this.activeTab = "moved";
                        } else if (changes.updated.length > 0) {
                            this.activeTab = "updated";
                        } else if (changes.newEnums.length > 0) {
                            this.activeTab = "newEnums";
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

            const scpi = this.context.project.scpi;

            let existingSubsystems = scpi.subsystems;

            let getOrAddSubsystem = (subsystem: Subsystem) => {
                let existingSubsystem = existingSubsystems.find(
                    existingSubsystem =>
                        existingSubsystem.name === subsystem.name
                );
                if (existingSubsystem) {
                    return existingSubsystem;
                }

                const scpiSubsystem = createObject<ScpiSubsystem>(
                    this.context,
                    {
                        name: subsystem.name,
                        helpLink: subsystem.helpLink,
                        commands: []
                    },
                    ScpiSubsystem
                );

                return this.context.addObject(
                    existingSubsystems,
                    scpiSubsystem
                ) as ScpiSubsystem;
            };

            this.changes.subsystems.forEach(subsystem =>
                getOrAddSubsystem(subsystem)
            );

            this.selectedChanges.added.forEach(commandDefinition => {
                let subsystem = getOrAddSubsystem(commandDefinition.subsystem);

                const command = createObject<ScpiCommand>(
                    this.context,
                    commandDefinition.command as any,
                    ScpiCommand
                );

                this.context.addObject(subsystem.commands, command);
            });

            this.selectedChanges.deleted.forEach(commandDefinition => {
                let result = findCommandInScpiSubsystems(
                    existingSubsystems,
                    commandDefinition.command.name
                );
                if (result) {
                    this.context.deleteObject(result.command as ScpiCommand);
                }
            });

            this.selectedChanges.moved.forEach(commandDefinition => {
                let result = findCommandInScpiSubsystems(
                    existingSubsystems,
                    commandDefinition.command.name
                );
                if (result) {
                    let command = result.command as ScpiCommand;
                    this.context.deleteObject(command);

                    command.helpLink = commandDefinition.command.helpLink;

                    let subsystem = getOrAddSubsystem(
                        commandDefinition.toSubsystem
                    );

                    this.context.addObject(subsystem.commands, command);
                }
            });

            this.selectedChanges.newEnums.forEach(newEnum => {
                this.context.addObject(
                    scpi.enums,
                    createObject<ScpiEnum>(
                        this.context,
                        newEnum as any,
                        ScpiEnum
                    )
                );
            });

            this.selectedChanges.updated.forEach(commandDefinition => {
                let result = findCommandInScpiSubsystems(
                    existingSubsystems,
                    commandDefinition.command.name
                );
                if (result) {
                    this.context.updateObject(result.command, {
                        helpLink: commandDefinition.command.helpLink,
                        parameters: toJS(
                            commandDefinition.command.parameters
                        ).map(parameter => {
                            return {
                                name: parameter.name,
                                type: parameter.type.map(type => {
                                    if (type.type === "discrete") {
                                        if (
                                            !scpi.enums.find(
                                                scpiEnum =>
                                                    scpiEnum.name ===
                                                    type.enumeration
                                            )
                                        ) {
                                            return {
                                                type: "discrete"
                                            };
                                        }
                                    }
                                    return type;
                                }),
                                isOptional: parameter.isOptional,
                                description: parameter.description
                            };
                        })
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
                } else if (section === "moved") {
                    checkbox = this.movedSelectAllCheckbox;
                } else if (section === "updated") {
                    checkbox = this.updatedSelectAllCheckbox;
                } else {
                    checkbox = this.newEnumsSelectAllCheckbox;
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
            changeDefinition: CommandDefinition | IEnum
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
                        } else if (section === "moved") {
                            thead = (
                                <tr>
                                    <th className="col-6">
                                        <input
                                            ref={ref =>
                                                (this.movedSelectAllCheckbox =
                                                    ref!)
                                            }
                                            type="checkbox"
                                        />{" "}
                                        Command
                                    </th>
                                    <th className="col-3">From</th>
                                    <th className="col-3">To</th>
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
                        } else if (section === "newEnums") {
                            thead = (
                                <tr>
                                    <th className="col-4">
                                        <input
                                            ref={ref =>
                                                (this.newEnumsSelectAllCheckbox =
                                                    ref!)
                                            }
                                            type="checkbox"
                                        />{" "}
                                        Enum
                                    </th>
                                    <th className="col-8">Members</th>
                                </tr>
                            );
                        }

                        let tbody = (this.changes[section] as any).map(
                            (
                                commandOrNewEnumDefinition:
                                    | CommandDefinition
                                    | IEnum
                            ) => {
                                let checkbox = (
                                    <input
                                        type="checkbox"
                                        checked={this.isChangeSelected(
                                            section,
                                            commandOrNewEnumDefinition
                                        )}
                                        onChange={this.handleSelectCommand.bind(
                                            this,
                                            section,
                                            commandOrNewEnumDefinition
                                        )}
                                    />
                                );

                                if (section === "newEnums") {
                                    const newEnum =
                                        commandOrNewEnumDefinition as IEnum;

                                    return (
                                        <tr key={newEnum.name}>
                                            <td className="col-4">
                                                {checkbox} {newEnum.name}
                                            </td>
                                            <td className="col-8">
                                                {newEnum.members
                                                    .map(member => member.name)
                                                    .join("|")}
                                            </td>
                                        </tr>
                                    );
                                } else {
                                    const commandDefinition =
                                        commandOrNewEnumDefinition as CommandDefinition;

                                    if (
                                        section === "added" ||
                                        section === "deleted" ||
                                        section === "updated"
                                    ) {
                                        return (
                                            <tr
                                                key={
                                                    commandDefinition.command
                                                        .name
                                                }
                                            >
                                                <td className="col-8">
                                                    {checkbox}{" "}
                                                    {
                                                        commandDefinition
                                                            .command.name
                                                    }
                                                </td>
                                                <td className="col-4">
                                                    {
                                                        commandDefinition
                                                            .subsystem.name
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    } else {
                                        // section === "moved"
                                        return (
                                            <tr
                                                key={
                                                    commandDefinition.command
                                                        .name
                                                }
                                            >
                                                <td className="col-6">
                                                    {checkbox}{" "}
                                                    {
                                                        commandDefinition
                                                            .command.name
                                                    }
                                                </td>
                                                <td className="col-3">
                                                    {
                                                        commandDefinition
                                                            .subsystem.name
                                                    }
                                                </td>
                                                <td className="col-3">
                                                    {
                                                        (
                                                            commandDefinition as MovedCommandDefinition
                                                        ).toSubsystem.name
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    }
                                }
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
                                    Detected SCPI Command Changes
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

export function showImportScpiDocDialog(projectStore: ProjectStore) {
    let el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    root.render(
        <ProjectContext.Provider value={projectStore}>
            <ImportScpiDocDialog
                onHidden={() => {
                    el.remove();
                }}
            />
        </ProjectContext.Provider>
    );
}
