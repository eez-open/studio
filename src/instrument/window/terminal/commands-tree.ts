import { observable, runInAction } from "mobx";

import { scheduleTask, Priority } from "shared/scheduler";

import { loadCommands } from "instrument/import";
import { commandsToTree, ScpiCommandTreeNode } from "instrument/commands-tree";

import { appStore } from "instrument/window/app-store";

import { ICommandNode } from "instrument/window/terminal/commands-browser";

////////////////////////////////////////////////////////////////////////////////

export const commandsTree: ICommandNode = observable({
    id: "",
    label: "",
    selected: false,
    expanded: true,
    children: []
});

function transform(nodes: ScpiCommandTreeNode[] | undefined): ICommandNode[] {
    if (nodes) {
        return nodes.map(node =>
            observable({
                id: node.mnemonic,
                label: node.mnemonic,
                selected: false,
                expanded: false,
                children: transform(node.nodes),
                commandSyntax: node.command && node.command.commandSyntax,
                querySyntax: node.command && node.command.querySyntax
            })
        );
    } else {
        return [];
    }
}

export async function loadCommandsTree(extensionId: string) {
    let commands = await loadCommands(extensionId);
    runInAction(() => {
        commandsTree.children = transform(commandsToTree(commands).nodes);
    });
}

scheduleTask("Load commands tree", Priority.Low, () => {
    loadCommandsTree(appStore.instrument!.instrumentExtensionId);
});

//
