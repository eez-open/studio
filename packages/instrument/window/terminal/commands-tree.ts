import { observable, runInAction } from "mobx";

import { loadCommands } from "instrument/import";
import { IEnum } from "instrument/scpi";
import { commandsToTree, ScpiCommandTreeNode, ICommandSyntax } from "instrument/commands-tree";

import { ICommandNode } from "instrument/window/terminal/commands-browser";

////////////////////////////////////////////////////////////////////////////////

class CommandNode implements ICommandNode {
    @observable id: string = "";
    @observable label: string = "";
    @observable selected: boolean = false;
    @observable expanded: boolean = true;
    @observable children: CommandsTree[] = [];
    @observable commandSyntax: ICommandSyntax | undefined = undefined;
    @observable querySyntax: ICommandSyntax | undefined = undefined;

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
                        id: node.mnemonic,
                        label: node.mnemonic,
                        selected: false,
                        expanded: false,
                        children: this.transform(node.nodes),
                        commandSyntax: node.command && node.command.commandSyntax,
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
}
