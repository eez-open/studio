import React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";
import { IListNode, List } from "eez-studio-ui/list";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Splitter } from "eez-studio-ui/splitter";
import { VerticalHeaderWithBody, Header, PanelHeader, Body } from "eez-studio-ui/header-with-body";
import { SearchInput } from "eez-studio-ui/search-input";

import { ICommandSyntax, makeItShort, matchCommand } from "instrument/commands-tree";

import { InstrumentAppStore } from "instrument/window/app-store";
import { insertScpiCommandIntoCode, insertScpiQueryIntoCode } from "instrument/window/scripts";

export interface ICommandNode extends ITreeNode {
    commandSyntax?: ICommandSyntax;
    querySyntax?: ICommandSyntax;
}

@observer
export class CommandSyntax extends React.Component<
    {
        appStore: InstrumentAppStore;
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

const CommandsBrowserLeft = styled(VerticalHeaderWithBody)`
    > div:nth-child(1) {
        padding: 1px;
        padding-top: 2px;
        border-bottom: 1px solid ${props => props.theme.borderColor};
    }
`;

const CommandsBrowserRight = styled(VerticalHeaderWithBody)`
    > div:nth-child(1) {
        td {
            padding: 5px;

            p {
                margin-bottom: 0;
            }
        }
    }

    > div:nth-child(2) {
        display: flex;
        iframe {
            border: 0;
            flex-grow: 1;
        }
    }
`;

@observer
export class CommandsBrowser extends React.Component<
    {
        appStore: InstrumentAppStore;
        host: {
            command: string;
        };
    },
    {}
> {
    @observable
    selectedNode: ICommandNode;
    @observable
    searchText: string = "";

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

        visitCommandNode(this.props.appStore.commandsTree);

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
        let leftSideBody;
        if (this.searchText) {
            leftSideBody = <List nodes={this.foundNodes} selectNode={this.selectNode} />;
        } else {
            leftSideBody = (
                <Tree
                    rootNode={this.props.appStore.commandsTree}
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

            selectedNodeDetails = (
                <React.Fragment>
                    <PanelHeader className="">
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
                    </PanelHeader>
                    <Body>{helpLink && <iframe src={helpLink} />}</Body>
                </React.Fragment>
            );
        }

        return (
            <Splitter
                type="horizontal"
                sizes="240px|100%"
                persistId="instrument/window/commands-browser/splitter"
            >
                <CommandsBrowserLeft className="">
                    <Header>
                        <SearchInput
                            searchText={this.searchText}
                            onChange={this.onSearchChange}
                            onKeyDown={this.onSearchChange}
                        />
                    </Header>
                    <Body tabIndex={0}>{leftSideBody}</Body>
                </CommandsBrowserLeft>
                <CommandsBrowserRight className="">{selectedNodeDetails}</CommandsBrowserRight>
            </Splitter>
        );
    }
}
