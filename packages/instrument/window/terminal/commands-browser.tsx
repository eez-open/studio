import React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import {
    VALIDATION_MESSAGE_REQUIRED,
    filterInteger,
    filterNumber
} from "eez-studio-shared/validation";

import { IListNode, List } from "eez-studio-ui/list";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Splitter } from "eez-studio-ui/splitter";
import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { SearchInput } from "eez-studio-ui/search-input";
import { PropertyList, TextInputProperty } from "eez-studio-ui/properties";

import { IParameter, compareMnemonic } from "instrument/scpi";
import {
    ICommandSyntax,
    IQuerySyntax,
    makeItShort,
    matchCommand
} from "instrument/commands-tree";

import { InstrumentAppStore } from "instrument/window/app-store";
import {
    insertScpiCommandIntoCode,
    insertScpiQueryIntoCode
} from "instrument/window/scripts";

export interface ICommandNode extends ITreeNode {
    commandSyntax?: ICommandSyntax;
    querySyntax?: IQuerySyntax;
}

@observer
export class CommandSyntax extends React.Component<
    {
        appStore: InstrumentAppStore;
        commandSyntax: ICommandSyntax | IQuerySyntax;
        copyCommand: (
            command: ICommandSyntax | IQuerySyntax,
            commandParameters: string
        ) => void;
    },
    {}
> {
    @observable parameterValues = new Map<string, string>();
    @observable errors = new Map<string, string[]>();

    addError(parameterName: string, error: string) {
        const parameterErrors = this.errors.get(parameterName);
        if (parameterErrors) {
            parameterErrors.push(error);
        } else {
            this.errors.set(parameterName, [error]);
        }
    }

    validateParameterValue(parameterValue: string, parameter: IParameter) {
        const types: string[] = [];

        for (let i = 0; i < parameter.type.length; ++i) {
            const type = parameter.type[i];
            if (type.type === "nr1") {
                const num = filterInteger(parameterValue);
                if (!isNaN(num)) {
                    return [null, parameterValue];
                }
                types.push("nr1");
            } else if (type.type === "nr2" || type.type === "nr3") {
                const num = filterNumber(parameterValue);
                if (!isNaN(num)) {
                    return [null, parameterValue];
                }
                types.push("nr2");
            } else if (type.type === "boolean") {
                const num = filterNumber(parameterValue);
                if (!isNaN(num) && (num === 0 || num === 1)) {
                    return [null, parameterValue];
                }
                types.push("Boolean");
            } else if (type.type === "discrete") {
                const enumeration = this.props.appStore.commandsTree.enums.find(
                    enumeration =>
                        enumeration.name === parameter.type[i].enumeration
                );
                if (enumeration) {
                    for (let j = 0; j < enumeration.members.length; ++j) {
                        if (
                            compareMnemonic(
                                enumeration.members[j].name,
                                parameterValue
                            )
                        ) {
                            return [null, parameterValue];
                        }
                    }
                }
                types.push(`Discrete<${parameter.type[i].enumeration}>`);
            } else if (type.type === "channel-list") {
                return [null, parameterValue];
            }
        }

        for (let i = 0; i < parameter.type.length; ++i) {
            const type = parameter.type[i];
            if (type.type === "quoted-string") {
                return [null, `"${parameterValue}"`];
            }
        }

        if (types.length === 0) {
            return [null, parameterValue];
        }

        if (types.length === 1) {
            return [`Expected ${types[0]} value`];
        }

        return [
            `Expected ${types.slice(0, types.length - 1).join(", ")} or ${
                types[types.length - 1]
            } value`
        ];
    }

    @action
    validateParameters() {
        this.errors.clear();

        const parameters = this.props.commandSyntax.parameters;

        const finalValues = [];

        for (let i = 0; i < parameters.length; ++i) {
            let value = this.parameterValues.get(parameters[i].name);
            if (value) {
                value = value.trim();
            }

            if (value) {
                const [error, finalValue] = this.validateParameterValue(
                    value,
                    parameters[i]
                );
                if (error != null) {
                    this.addError(parameters[i].name, error);
                } else {
                    finalValues.push(finalValue);
                }
            } else {
                if (!parameters[i].isOptional) {
                    this.addError(
                        parameters[i].name,
                        VALIDATION_MESSAGE_REQUIRED
                    );
                } else {
                    for (let j = i + 1; j < parameters.length; ++j) {
                        let value2 = this.parameterValues.get(
                            parameters[j].name
                        );
                        if (value2) {
                            value2 = value2.trim();
                        }
                        if (value2) {
                            this.addError(
                                parameters[i].name,
                                VALIDATION_MESSAGE_REQUIRED
                            );
                            break;
                        }
                    }
                }
            }
        }

        if (this.errors.size > 0) {
            return false;
        }

        if (finalValues.length === 0) {
            return "";
        }

        return " " + finalValues.join(", ");
    }

    @bind
    copy() {
        const commandParameters = this.validateParameters();
        if (commandParameters !== false) {
            this.props.copyCommand(this.props.commandSyntax, commandParameters);
        }
    }

    @bind
    copyToScript() {
        const commandParameters = this.validateParameters();
        if (commandParameters !== false) {
            const command = this.props.commandSyntax.name + commandParameters;
            if (this.props.commandSyntax.name.endsWith("?")) {
                insertScpiQueryIntoCode(this.props.appStore, command);
            } else {
                insertScpiCommandIntoCode(this.props.appStore, command);
            }
        }
    }

    render() {
        return (
            <div className="EezStudio_CommandSyntaxContainer">
                <h5>{this.props.commandSyntax.name}</h5>
                <div className="EezStudio_Parameters">
                    <PropertyList>
                        {this.props.commandSyntax.parameters.map(parameter => {
                            const suggestions: string[] = [];

                            for (let i = 0; i < parameter.type.length; ++i) {
                                if (parameter.type[i].type === "discrete") {
                                    const enumeration =
                                        this.props.appStore.commandsTree.enums.find(
                                            enumeration =>
                                                enumeration.name ===
                                                parameter.type[i].enumeration
                                        );
                                    if (enumeration) {
                                        enumeration.members.forEach(member =>
                                            suggestions.push(member.name)
                                        );
                                    }
                                }
                            }

                            return (
                                <TextInputProperty
                                    key={parameter.name}
                                    title={parameter.description}
                                    name={
                                        parameter.isOptional
                                            ? `[ ${parameter.name} ]`
                                            : parameter.name
                                    }
                                    value={
                                        this.parameterValues.get(
                                            parameter.name
                                        ) || ""
                                    }
                                    onChange={action((value: string) =>
                                        this.parameterValues.set(
                                            parameter.name,
                                            value
                                        )
                                    )}
                                    suggestions={suggestions}
                                    errors={this.errors.get(parameter.name)}
                                />
                            );
                        })}
                    </PropertyList>
                </div>
                <div>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={this.copy}
                    >
                        Copy
                    </button>
                    {this.props.appStore.navigationStore
                        .mainNavigationSelectedItem ===
                        this.props.appStore.navigationStore
                            .scriptsNavigationItem &&
                        this.props.appStore.scriptsModel.selectedScript && (
                            <button
                                className="btn btn-secondary btn-sm ml-2"
                                onClick={this.copyToScript}
                            >
                                Copy to script
                            </button>
                        )}
                </div>
            </div>
        );
    }
}

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
                    data: undefined,
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
    copyCommand(command: ICommandSyntax, commandParameters: string) {
        this.props.host.command = makeItShort(command) + commandParameters;
    }

    @action.bound
    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
    }

    render() {
        let leftSideBody;
        if (this.searchText) {
            leftSideBody = (
                <List nodes={this.foundNodes} selectNode={this.selectNode} />
            );
        } else {
            leftSideBody = (
                <Tree
                    rootNode={this.props.appStore.commandsTree}
                    selectNode={this.selectNode}
                    showOnlyChildren={true}
                />
            );
        }

        let syntax;
        let help;
        if (this.selectedNode) {
            syntax = (
                <div className="EezStudio_CommandSyntaxes">
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
                </div>
            );

            let helpLink =
                (this.selectedNode.commandSyntax &&
                    this.selectedNode.commandSyntax.url) ||
                (this.selectedNode.querySyntax &&
                    this.selectedNode.querySyntax.url);
            help = helpLink && <iframe src={helpLink} />;
        }

        return (
            <Splitter
                type="horizontal"
                sizes="240px|100%"
                persistId="instrument/window/commands-browser/splitter1"
            >
                <VerticalHeaderWithBody className="EezStudio_CommandsBrowserTree">
                    <Header>
                        <SearchInput
                            searchText={this.searchText}
                            onChange={this.onSearchChange}
                            onKeyDown={this.onSearchChange}
                        />
                    </Header>
                    <Body tabIndex={0}>{leftSideBody}</Body>
                </VerticalHeaderWithBody>
                <Splitter
                    type="horizontal"
                    sizes="400px|100%"
                    persistId="instrument/window/commands-browser/splitter2"
                >
                    <div className="EezStudio_CommandsBrowserSyntax">
                        {syntax}
                    </div>
                    <div className="EezStudio_CommandsBrowserHelp">{help}</div>
                </Splitter>
            </Splitter>
        );
    }
}
