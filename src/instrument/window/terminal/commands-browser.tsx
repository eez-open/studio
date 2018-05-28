import * as React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { IListNode, List } from "shared/ui/list";
import { ITreeNode, Tree } from "shared/ui/tree";
import { Splitter } from "shared/ui/splitter";
import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";

import { ICommandSyntax, makeItShort, matchCommand } from "instrument/commands-tree";

import { AppStore } from "instrument/window/app-store";
import { insertScpiCommandIntoCode, insertScpiQueryIntoCode } from "instrument/window/scripts";

import { commandsTree } from "instrument/window/terminal/commands-tree";

export interface ICommandNode extends ITreeNode {
    commandSyntax?: ICommandSyntax;
    querySyntax?: ICommandSyntax;
}

@observer
export class CommandSyntax extends React.Component<
    {
        appStore: AppStore;
        commandSyntax: ICommandSyntax;
        copyCommand: (command: ICommandSyntax) => void;
    },
    {}
> {
    @bind
    copy() {
        this.props.copyCommand(this.props.commandSyntax);
    }

    @bind
    copyToScript() {
        if (this.props.commandSyntax.name.endsWith("?")) {
            insertScpiQueryIntoCode(this.props.appStore, this.props.commandSyntax.name);
        } else {
            insertScpiCommandIntoCode(this.props.appStore, this.props.commandSyntax.name);
        }
    }

    render() {
        return (
            <tr>
                <td>{this.props.commandSyntax.name}</td>
                <td>
                    <button className="btn btn-sm" onClick={this.copy}>
                        Copy
                    </button>
                    {this.props.appStore.navigationStore.mainNavigationSelectedItem ===
                        this.props.appStore.navigationStore.scriptsNavigationItem &&
                        this.props.appStore.scriptsModel.selectedScript && (
                            <button className="btn btn-sm ml-1" onClick={this.copyToScript}>
                                Copy to script
                            </button>
                        )}
                </td>
            </tr>
        );
    }
}

@observer
export class CommandsBrowser extends React.Component<
    {
        appStore: AppStore;
        host: {
            command: string;
        };
    },
    {}
> {
    @observable selectedNode: ICommandNode;
    @observable searchText: string = "";

    @computed
    get foundNodes(): IListNode[] {
        let foundNodes: (IListNode & {
            commandNode: ICommandNode;
        })[] = [];

        let searchText = this.searchText.toLowerCase();
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
                    selected: node === selectedNode,
                    commandNode: node
                });
            }

            node.children.forEach(visitCommandNode);
        }

        visitCommandNode(commandsTree);

        return foundNodes;
    }

    @action.bound
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

    @bind
    copyCommand(command: ICommandSyntax) {
        this.props.host.command = makeItShort(command);
    }

    @action.bound
    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
    }

    render() {
        let inputClassName = classNames("EezStudio_SearchInput", {
            empty: !this.searchText
        });

        let leftSideBody;
        if (this.searchText) {
            leftSideBody = <List nodes={this.foundNodes} selectNode={this.selectNode} />;
        } else {
            leftSideBody = (
                <Tree
                    rootNode={commandsTree}
                    selectNode={this.selectNode}
                    showOnlyChildren={true}
                />
            );
        }

        let selectedNodeDetails;
        if (this.selectedNode) {
            let helpLink =
                (this.selectedNode.commandSyntax && this.selectedNode.commandSyntax.url) ||
                (this.selectedNode.querySyntax && this.selectedNode.querySyntax.url);

            selectedNodeDetails = [
                <Header key="top">
                    <table>
                        <tbody>
                            {this.selectedNode.commandSyntax && (
                                <CommandSyntax
                                    appStore={this.props.appStore}
                                    commandSyntax={this.selectedNode.commandSyntax}
                                    copyCommand={this.copyCommand}
                                />
                            )}
                            {this.selectedNode.querySyntax && (
                                <CommandSyntax
                                    appStore={this.props.appStore}
                                    commandSyntax={this.selectedNode.querySyntax}
                                    copyCommand={this.copyCommand}
                                />
                            )}
                        </tbody>
                    </table>
                </Header>,
                <Body key="bottom">{helpLink && <iframe src={helpLink} />}</Body>
            ];
        }

        return (
            <Splitter
                type="horizontal"
                sizes="240px|100%"
                persistId="instrument/window/commands-browser/splitter"
            >
                <VerticalHeaderWithBody className="EezStudio_Left">
                    <Header>
                        <input
                            type="text"
                            placeholder="&#xe8b6;"
                            className={inputClassName}
                            value={this.searchText}
                            onChange={this.onSearchChange}
                            onKeyDown={this.onSearchChange}
                        />
                    </Header>
                    <Body tabIndex={0}>{leftSideBody}</Body>
                </VerticalHeaderWithBody>
                <VerticalHeaderWithBody className="EezStudio_Right">
                    {selectedNodeDetails}
                </VerticalHeaderWithBody>
            </Splitter>
        );
    }
}
