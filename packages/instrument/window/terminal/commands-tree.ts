import { observable, runInAction } from "mobx";

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
    @observable id: string = "";
    @observable label: string = "";
    @observable selected: boolean = false;
    @observable expanded: boolean = true;
    @observable children: CommandsTree[] = [];
    @observable commandSyntax: ICommandSyntax | undefined = undefined;
    @observable querySyntax: IQuerySyntax | undefined = undefined;

    constructor(props: any) {
        Object.assign(this, props);
    }
}

export class CommandsTree {
    @observable id: string = "";
    @observable label: string = "";
    @observable selected: boolean = false;
    @observable expanded: boolean = true;
    @observable children: ICommandNode[] = [];
    enums: IEnum[];

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

    async load(extensionId: string) {
        let { enums, commands } = await loadCommands(extensionId);

        this.enums = enums;

        runInAction(() => {
            this.children = this.transform(commandsToTree(commands).nodes);
        });
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
        return this.findCommandInChildren(commandName, this.children);
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
