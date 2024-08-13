import {
    observable,
    runInAction,
    makeObservable,
    reaction,
    action,
    computed
} from "mobx";

import { CommandsTree } from "instrument/window/terminal/commands-tree";
import type { InstrumentObject } from "instrument/instrument-object";
import { parseIdentifier } from "project-editor/flow/expression";
import { ICommandNode } from "instrument/window/terminal/commands-browser";
import { ITreeNode } from "eez-studio-ui/tree";
import { IListNode } from "eez-studio-ui/list";
import { matchCommand } from "instrument/commands-tree";

export class TerminalState {
    static _linkCommandInputWithDocumentationBrowser =
        observable.box<boolean>();

    _command: string = "";
    searchText: string;

    selectedNode: ICommandNode | undefined;

    constructor(public instrument: InstrumentObject | undefined) {
        makeObservable(this, {
            _command: observable,
            searchText: observable,
            instrument: observable,
            selectedNode: observable,
            setSearchText: action,
            commandsTree: computed,
            selectNode: action.bound,
            selectPreviousNode: action,
            selectNextNode: action,
            foundNodes: computed,
            selectedNodeIndex: computed
        });
    }

    get command() {
        return this._command;
    }

    set command(command: string) {
        runInAction(() => {
            this._command = command;

            if (this.linkCommandInputWithDocumentationBrowser) {
                this.setSearchText(command);
            }
        });
    }

    get linkCommandInputWithDocumentationBrowser() {
        return TerminalState._linkCommandInputWithDocumentationBrowser.get();
    }

    set linkCommandInputWithDocumentationBrowser(value: boolean) {
        runInAction(() => {
            TerminalState._linkCommandInputWithDocumentationBrowser.set(value);
            if (this.linkCommandInputWithDocumentationBrowser) {
                this.setSearchText(this.command);
            }
        });
    }

    get commandsTree() {
        console.log("get commands tree");
        const commandsTree = new CommandsTree();
        if (this.instrument) {
            commandsTree.load(this.instrument.instrumentExtensionId);
        }
        return commandsTree;
    }

    setSearchText(command: string) {
        // skip optional assignment
        if (command.startsWith("{")) {
            const i = command.indexOf("}", 1);
            if (i == -1) {
                if (this.searchText) {
                    this.searchText = "";
                    this.selectFirstNode();
                }
                return;
            }
            command = command.substring(i + 1).trim();
        } else {
            let i = command.indexOf("=", 1);

            if (i != -1) {
                if (parseIdentifier(command.substring(0, i).trim())) {
                    command = command.substring(i).trim();
                }
            }
        }
        if (command.startsWith("=")) {
            command = command.substring(1);
        }
        if (command.startsWith("?")) {
            command = command.substring(1);
        }

        command = command.trim().split(" ")[0];
        if (command.endsWith("?")) {
            command = command.substring(0, command.length - 1);
        }

        // remove everything between { and }
        let searchText = "";
        let inside = false;
        for (let i = 0; i < command.length; i++) {
            if (inside) {
                if (command[i] == "}") {
                    inside = false;
                }
            } else {
                if (command[i] == "{") {
                    inside = true;
                } else {
                    searchText += command[i];
                }
            }
        }

        if (searchText != this.searchText) {
            this.searchText = searchText;
            this.selectFirstNode();
        }
    }

    selectNode(node: ITreeNode | IListNode) {
        let commandNode: ICommandNode;

        if ((node as any).commandNode) {
            commandNode = (node as any).commandNode;
        } else {
            commandNode = node as ICommandNode;
        }

        if (this.selectedNode) {
            this.selectedNode.selected = false;
        }

        this.selectedNode = commandNode;

        if (this.selectedNode) {
            this.selectedNode.selected = true;
        }
    }

    doSelect(inc: number) {
        if (!this.searchText) {
            return;
        }

        let i = this.selectedNodeIndex;

        if (i != -1) {
            i += inc;
            if (i < 0) {
                i = this.foundNodes.length - 1;
            } else if (i >= this.foundNodes.length) {
                i = 0;
            }
        } else {
            i = 0;
        }

        if (i >= 0 && i < this.foundNodes.length) {
            this.selectedNode = this.foundNodes[i].data;
        } else {
            this.selectedNode = undefined;
        }
    }

    selectFirstNode() {
        if (!this.searchText) {
            return;
        }

        if (this.foundNodes.length > 0) {
            this.selectedNode = this.foundNodes[0].data;
        } else {
            this.selectedNode = undefined;
        }
    }

    selectPreviousNode() {
        this.doSelect(-1);
    }

    selectNextNode() {
        this.doSelect(1);
    }

    get foundNodes(): IListNode[] {
        let foundNodes: (IListNode & {
            commandNode: ICommandNode;
        })[] = [];

        let searchText = (this.searchText || "").toLowerCase();
        let selectedNode = this.selectedNode;

        function visitCommandNode(node: ICommandNode) {
            let command = matchCommand(node.commandSyntax, searchText);

            if (!command) {
                command = matchCommand(node.querySyntax, searchText);
            }

            if (command) {
                foundNodes.push({
                    id: command,
                    label: command,
                    data: node,
                    selected: node === selectedNode,
                    commandNode: node
                });
            }

            node.children.forEach(visitCommandNode);
        }

        visitCommandNode(this.commandsTree);

        return foundNodes;
    }

    get selectedNodeIndex() {
        if (!this.searchText) {
            return -1;
        }

        if (!this.selectNode) {
            return -1;
        }

        return this.foundNodes.findIndex(
            node => node.data == this.selectedNode
        );
    }
}

TerminalState._linkCommandInputWithDocumentationBrowser.set(
    !(
        localStorage.getItem("linkCommandInputWithDocumentationBrowser") ===
            "false" || false
    )
);

reaction(
    () => TerminalState._linkCommandInputWithDocumentationBrowser.get(),
    value => {
        localStorage.setItem(
            "linkCommandInputWithDocumentationBrowser",
            value ? "true" : "false"
        );
    }
);
