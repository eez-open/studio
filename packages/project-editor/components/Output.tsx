import { action, autorun } from "mobx";
import { observer, disposeOnUnmount } from "mobx-react";
import React from "react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";
import { TabsView } from "eez-studio-ui/tabs";
import styled from "eez-studio-ui/styled-components";
import { IconAction } from "eez-studio-ui/action";

import { Message as OutputMessage, Type as MessageType } from "project-editor/core/output";

import { ObjectPath } from "project-editor/components/ObjectPath";
import { ProjectContext } from "project-editor/project/context";

const MAX_OUTPUT_MESSAGE_TEXT_SIZE = 1000;

////////////////////////////////////////////////////////////////////////////////

const MessageRow = styled.tr`
    cursor: pointer;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.selected {
        background-color: ${props => props.theme.nonFocusedSelectionBackgroundColor};
        color: ${props => props.theme.nonFocusedSelectionColor};
    }
`;

@observer
class Message extends React.Component<
    {
        message: OutputMessage;
        onSelect: (message: OutputMessage) => void;
    },
    {}
> {
    render() {
        let iconName = "material:";
        let iconClassName;
        if (this.props.message.type == MessageType.ERROR) {
            iconName += "error";
            iconClassName = "error";
        } else if (this.props.message.type == MessageType.WARNING) {
            iconName += "warning";
            iconClassName = "warning";
        } else {
            iconName += "info";
            iconClassName = "info";
        }
        let icon = <Icon icon={iconName} className={iconClassName} />;

        let objectPath: JSX.Element | undefined;
        if (this.props.message.object) {
            objectPath = <ObjectPath object={this.props.message.object} />;
        }

        let text = this.props.message.text;
        if (text.length > MAX_OUTPUT_MESSAGE_TEXT_SIZE) {
            text = text.substring(0, MAX_OUTPUT_MESSAGE_TEXT_SIZE) + "...";
        }

        let className = classNames("message-item", {
            selected: this.props.message.selected
        });

        return (
            <MessageRow
                className={className}
                onClick={() => this.props.onSelect(this.props.message)}
            >
                <td>
                    {icon} {text}
                </td>
                <td>{objectPath}</td>
            </MessageRow>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const MessagesDiv = styled.div`
    flex-grow: 1;
    overflow: auto;
    height: 100%;
    table {
        width: 100%;

        td:nth-child(2) {
            padding-left: 20px;
            width: 100%;
        }
    }
`;

@observer
class Messages extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>

    private divRef = React.createRef<any>();

    onSelectMessage(message: OutputMessage) {
        this.context.OutputSectionsStore.activeSection.selectMessage(message);
    }

    scrollToBottom() {
        if (this.divRef.current && this.context.OutputSectionsStore.activeSection.scrollToBottom) {
            const div: HTMLDivElement = this.divRef.current;
            div.scrollTop = div.scrollHeight;
        }
    }

    componentDidMount() {
        this.scrollToBottom();
    }

    componentDidUpdate() {
        this.scrollToBottom();
    }

    render() {
        // TODO this is workaround because for some reason componentDidUpdate is not called
        setTimeout(() => this.scrollToBottom());

        let rows = this.context.OutputSectionsStore.activeSection.messages.map(message => (
            <Message
                key={message.id}
                message={message}
                onSelect={this.onSelectMessage.bind(this)}
            />
        ));

        return (
            <MessagesDiv ref={this.divRef}>
                <table>
                    <tbody>{rows}</tbody>
                </table>
            </MessagesDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const OutputDiv = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    height: 100%;

    &:focus {
        .message-item {
            &:hover {
                background-color: ${props => props.theme.hoverBackgroundColor};
                color: ${props => props.theme.hoverColor};
            }

            &.selected {
                background-color: ${props => props.theme.selectionBackgroundColor};
                color: ${props => props.theme.selectionColor};
                * {
                    background-color: ${props => props.theme.selectionBackgroundColor};
                    color: ${props => props.theme.selectionColor};
                }
            }
        }
    }
`;

const TabsViewContainer = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    background-color: ${props => props.theme.panelHeaderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};

    > .EezStudio_Action {
        margin-right: 8px;
    }
`;

@observer
export class Output extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>

    @disposeOnUnmount
    activeSectionChanged = autorun(() => {
        this.context.NavigationStore.setSelectedPanel(this.context.OutputSectionsStore.activeSection);
    });

    onFocus() {
        this.context.NavigationStore.setSelectedPanel(this.context.OutputSectionsStore.activeSection);
    }

    @action.bound
    onKeyDown(event: any) {
        if (event.keyCode == 27) {
            // ESC KEY
            this.context.UIStateStore.viewOptions.outputVisible = !this.context.UIStateStore.viewOptions.outputVisible;
        }
    }

    @action.bound onClose() {
        this.context.UIStateStore.viewOptions.outputVisible = !this.context.UIStateStore.viewOptions.outputVisible;
    }

    render() {
        return (
            <OutputDiv tabIndex={0} onFocus={this.onFocus} onKeyDown={this.onKeyDown}>
                <TabsViewContainer>
                    <TabsView tabs={this.context.OutputSectionsStore.sections} />
                    <IconAction
                        icon="material:close"
                        iconSize={16}
                        onClick={this.onClose}
                        title="Close output panel"
                    ></IconAction>
                </TabsViewContainer>
                <Messages />
            </OutputDiv>
        );
    }
}
