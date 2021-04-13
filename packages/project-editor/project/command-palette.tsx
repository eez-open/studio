import React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";

import styled from "eez-studio-ui/styled-components";

import { ProjectContext } from "project-editor/project/context";
import { IListNode, List } from "eez-studio-ui/list";
import { SearchInput } from "eez-studio-ui/search-input";

import { Command, commands } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

const WrapperDiv = styled.div`
    z-index: 1000;
    position: absolute;
    top: 0;
    left: calc(50% - 300px);
    width: 600px;
    height: 500px;
    padding: 10px;
    display: flex;
    flex-direction: column;

    background-color: rgb(243, 243, 243);
    color: rgb(97, 97, 97);
    box-shadow: rgba(0, 0, 0, 0.16) 0px 0px 8px 2px;

    input {
        width: 100%;
    }

    & > div {
        flex-grow: 1;
        background-color: white;
        margin-top: 10px;
        border: 1px solid ${props => props.theme.borderColor};
    }
`;

@observer
export class CommandPalette extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    wrapperRef = React.createRef<HTMLDivElement>();

    @observable searchText: string = "";
    @observable selectedCommandIndex: number = 0;

    componentDidMount() {
        this.wrapperRef.current?.querySelector("input")?.focus();
        document.addEventListener("pointerdown", this.handleClickOutside, true);
    }

    componentWillUnmount() {
        document.removeEventListener(
            "pointerdown",
            this.handleClickOutside,
            true
        );
    }

    @action.bound
    handleClickOutside(event: PointerEvent) {
        if (
            !(event.target instanceof Node) ||
            !this.wrapperRef.current?.contains(event.target)
        ) {
            event.preventDefault();
            event.stopPropagation();
            this.context.UIStateStore.showCommandPalette = false;
        }
    }

    isCommandMatchSearchText(command: Command) {
        return (
            !this.searchText ||
            command.name.toLowerCase().indexOf(this.searchText.toLowerCase()) !=
                -1
        );
    }

    @computed get commands(): IListNode<Command>[] {
        return commands
            .filter(command => this.isCommandMatchSearchText(command))
            .map((command, i) => ({
                id: command.name,
                data: command,
                selected: i === this.selectedCommandIndex
            }));
    }

    @action.bound
    selectCommand(node?: IListNode<Command>) {
        const command = node?.data;

        if (command) {
            command.callback(this.context);
        }
    }

    renderCommand = (node: IListNode<Command>) => {
        const command = node.data;
        return command.name;
    };

    @action.bound
    onChangeSearchText(event: React.ChangeEvent<HTMLInputElement>) {
        this.searchText = event.currentTarget.value;
        this.selectedCommandIndex = this.commands.length > 0 ? 0 : -1;
    }

    @action.bound
    onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.keyCode == 27) {
            this.context.UIStateStore.showCommandPalette = false;
        } else if (event.keyCode == 13) {
            if (
                this.selectedCommandIndex >= 0 &&
                this.selectedCommandIndex < commands.length
            ) {
                this.context.UIStateStore.showCommandPalette = false;
                const command = commands[this.selectedCommandIndex];
                if (command) {
                    command.callback(this.context);
                }
            }
        } else if (event.keyCode == 40) {
            if (this.selectedCommandIndex + 1 < this.commands.length) {
                this.selectedCommandIndex++;
            }
        } else if (event.keyCode == 38) {
            if (this.selectedCommandIndex - 1 >= 0) {
                this.selectedCommandIndex--;
            }
        }
    }

    render() {
        return (
            <WrapperDiv ref={this.wrapperRef}>
                <SearchInput
                    searchText={this.searchText}
                    onChange={this.onChangeSearchText}
                    onKeyDown={this.onKeyDown}
                ></SearchInput>
                <List
                    nodes={this.commands}
                    selectNode={this.selectCommand}
                    renderNode={this.renderCommand}
                />
            </WrapperDiv>
        );
    }
}
