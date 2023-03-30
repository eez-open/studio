import { observable, runInAction, makeObservable } from "mobx";

import { loadCommands } from "instrument/import";
import { IEnum } from "instrument/scpi";
import {
    commandsToTree,
    ScpiCommandTreeNode,
    ICommandSyntax,
    IQuerySyntax,
    matchCommand
} from "instrument/commands-tree";

import { ICommandNode } from "instrument/window/terminal/commands-browser";

////////////////////////////////////////////////////////////////////////////////

class CommandNode implements ICommandNode {
    id: string = "";
    label: string = "";
    selected: boolean = false;
    expanded: boolean = true;
    children: CommandsTree[] = [];
    commandSyntax: ICommandSyntax | undefined = undefined;
    querySyntax: IQuerySyntax | undefined = undefined;

    constructor(props: any) {
        makeObservable(this, {
            id: observable,
            label: observable,
            selected: observable,
            expanded: observable,
            children: observable,
            commandSyntax: observable,
            querySyntax: observable
        });

        Object.assign(this, props);
    }
}

export class CommandsTree {
    id: string = "";
    label: string = "";
    selected: boolean = false;
    expanded: boolean = true;
    children: ICommandNode[] = [];
    enums: IEnum[];

    _findCommandCache = new Map<string, ICommandSyntax | IQuerySyntax>();

    _loadPromise: Promise<void>;

    constructor() {
        makeObservable(this, {
            id: observable,
            label: observable,
            selected: observable,
            expanded: observable,
            children: observable
        });
    }

    transform(nodes: ScpiCommandTreeNode[] | undefined): ICommandNode[] {
        if (nodes) {
            return nodes.map(
                node =>
                    new CommandNode({
                        id: node.mnemonic + (node.optional ? "_optional" : ""),
                        label: node.mnemonic,
                        selected: false,
                        expanded: false,
                        children: this.transform(node.nodes),
                        commandSyntax:
                            node.command && node.command.commandSyntax,
                        querySyntax: node.command && node.command.querySyntax
                    })
            );
        } else {
            return [];
        }
    }

    async doLoad(extensionId: string) {
        try {
            let { enums, commands } = await loadCommands(extensionId);

            this.enums = enums;

            runInAction(() => {
                this.children = this.transform(commandsToTree(commands).nodes);
            });
        } catch (err) {
            console.error(err);
        }
    }

    load(extensionId: string) {
        this._loadPromise = this.doLoad(extensionId);
    }

    async waitLoad() {
        await this._loadPromise;
    }

    findCommandInNode(
        commandName: string,
        commandNode: ICommandNode
    ): ICommandSyntax | IQuerySyntax | undefined {
        if (commandNode.querySyntax) {
            if (matchCommand(commandNode.querySyntax, commandName)) {
                return commandNode.querySyntax;
            }
        }

        if (commandNode.commandSyntax) {
            if (matchCommand(commandNode.commandSyntax, commandName)) {
                return commandNode.commandSyntax;
            }
        }

        return this.findCommandInChildren(commandName, commandNode.children);
    }

    findCommandInChildren(commandName: string, children: ICommandNode[]) {
        for (let i = 0; i < children.length; ++i) {
            const command = this.findCommandInNode(commandName, children[i]);
            if (command) {
                return command;
            }
        }
        return undefined;
    }

    findCommand(commandName: string) {
        let command: ICommandSyntax | IQuerySyntax | undefined =
            this._findCommandCache.get(commandName);
        if (!command) {
            command = this.findCommandInChildren(commandName, this.children);
            if (command) {
                this._findCommandCache.set(commandName, command);
            }
        }
        return command;
    }
}

const commandsTreeCache = new Map<string, CommandsTree>();

export function getCommandsTree(extensionId: string) {
    let commandsTree = commandsTreeCache.get(extensionId);
    if (!commandsTree) {
        commandsTree = new CommandsTree();
        commandsTreeCache.set(extensionId, commandsTree);
        commandsTree.load(extensionId);
    }
    return commandsTree;
}
