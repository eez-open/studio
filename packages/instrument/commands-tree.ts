import { NumericSuffix } from "instrument/import";
import { ICommand, IParameter, IResponse } from "instrument/scpi";

////////////////////////////////////////////////////////////////////////////////

export interface ICommandSyntax {
    name: string;
    url?: string;
    parameters: IParameter[];
    sendsBackDataBlock: boolean;
}

export interface IQuerySyntax {
    name: string;
    url?: string;
    parameters: IParameter[];
    response: IResponse;
}

export interface ScpiCommand {
    name: string;
    description?: string;
    commandSyntax?: ICommandSyntax;
    querySyntax?: IQuerySyntax;
}

export interface ScpiCommandTreeNode {
    mnemonic: string;
    optional?: boolean;
    numericSuffix?: NumericSuffix;
    nodes?: ScpiCommandTreeNode[];
    command?: ScpiCommand;
}

////////////////////////////////////////////////////////////////////////////////

export function splitCommandToMnemonics(command: string) {
    let mnemonics: string[] = [];

    let start = 0;
    let end = 0;
    let bracket = 0;
    while (end < command.length) {
        if (command[end] === "[") {
            if (command[end + 1] === ":") {
                mnemonics.push(command.substring(start, end));
                start = end;
                end += 2;
            }
            bracket++;
            end++;
        } else if (command[end] === "]") {
            if (--bracket === 0) {
                end++;
                mnemonics.push(command.substring(start, end));
                start = end;
            } else {
                end++;
            }
        } else if (command[end] === ":" && bracket === 0) {
            mnemonics.push(command.substring(start, end));
            end++;
            start = end;
        } else if (command[end] === "?") {
            mnemonics.push(command.substring(start, end));
            start = end;
            end++;
        } else {
            end++;
        }
    }

    mnemonics.push(command.substring(start, end));

    return mnemonics;
}

export function addCommandToTree(command: ICommand, tree: ScpiCommandTreeNode) {
    let mnemonics = splitCommandToMnemonics(command.name);

    let currentNode = tree;

    mnemonics.forEach(mnemonic => {
        if (mnemonic === "?" || mnemonic === "") {
            return;
        }

        let optional = mnemonic[0] === "[";
        let numericSuffix: NumericSuffix;
        if (mnemonic.indexOf("[<n>]") != -1) {
            numericSuffix = "optional";
        } else if (mnemonic.indexOf("<n>") != -1) {
            numericSuffix = "mandatory";
        } else {
            numericSuffix = "none";
        }

        mnemonic = mnemonic.replace(/[\[\]\:]/g, "").replace(/\<n\>/g, "");

        let node;

        if (currentNode.nodes) {
            node = currentNode.nodes.find(
                node =>
                    node.mnemonic === mnemonic &&
                    node.optional === optional &&
                    node.numericSuffix === numericSuffix
            );
        } else {
            currentNode.nodes = [];
        }

        if (!node || node.optional !== optional) {
            node = {
                mnemonic,
                optional,
                numericSuffix
            };
            currentNode.nodes.push(node);
        }

        currentNode = node;
    });

    let name;
    let query = false;
    if (command.name.endsWith("?")) {
        name = command.name.slice(0, -1);
        query = true;
    } else {
        name = command.name;
    }

    if (!currentNode.command) {
        currentNode.command = {
            name: name,
            description: command.description
        };
    }

    if (query) {
        currentNode.command.querySyntax = {
            name: command.name,
            url: command.helpLink,
            parameters: command.parameters,
            response: command.response
        };
    } else {
        currentNode.command.commandSyntax = {
            name: command.name,
            url: command.helpLink,
            parameters: command.parameters,
            sendsBackDataBlock: command.sendsBackDataBlock
        };
    }
}

export function commandsToTree(commands: ICommand[]) {
    let tree: ScpiCommandTreeNode = {
        mnemonic: ""
    };

    commands.forEach(command => addCommandToTree(command, tree));

    return tree;
}

export function makeItShort(command: ICommandSyntax) {
    let shortCommand = command.name
        .replace(/\[\<n\>\]/g, "1")
        .replace(/\<n\>/g, "")
        .replace(/\[.*?\]/g, "");

    if (shortCommand.startsWith(":")) {
        shortCommand = shortCommand.slice(1);
    }

    return shortCommand;
}

export function matchCommand(
    commandSyntax: ICommandSyntax | IQuerySyntax | undefined,
    pattern: string
) {
    if (!commandSyntax) {
        return undefined;
    }

    let command = commandSyntax.name.toLowerCase();
    pattern = pattern.toLowerCase();

    let position = 0;
    let parts = pattern.split(":");
    for (let i = 0; i < parts.length; i++) {
        position = command.indexOf(parts[i], position);
        if (position === -1) {
            return undefined;
        }

        position++;

        if (i < parts.length - 1) {
            position = command.indexOf(":", position);
            if (position === -1) {
                return undefined;
            }

            position++;
        }
    }

    return commandSyntax.name;
}
