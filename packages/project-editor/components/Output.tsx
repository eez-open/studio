import { action } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";
import { TabsView } from "eez-studio-ui/tabs";
import styled from "eez-studio-ui/styled-components";

import { UIStateStore, OutputSectionsStore, NavigationStore } from "project-editor/core/store";
import { Message as OutputMessage, Type as MessageType } from "project-editor/core/output";

import { ObjectPath } from "project-editor/components/ObjectPath";

const MAX_OUTPUT_MESSAGE_TEXT_SIZE = 100;

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

    table {
        width: 100%;

        td:nth-child(2) {
            padding-left: 20px;
            width: 100%;
        }
    }
`;

@observer
class Messages extends React.Component<{}, {}> {
    onSelectMessage(message: OutputMessage) {
        OutputSectionsStore.activeSection.selectMessage(message);
    }

    render() {
        let rows = OutputSectionsStore.activeSection.messages.map(message => (
            <Message
                key={message.id}
                message={message}
                onSelect={this.onSelectMessage.bind(this)}
            />
        ));

        return (
            <MessagesDiv>
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
`;

@observer
export class Output extends React.Component<{}, {}> {
    onSelectSection(event: any) {
        OutputSectionsStore.setActiveSection(event.target.value);
    }

    onFocus() {
        NavigationStore.setSelectedPanel(OutputSectionsStore.activeSection);
    }

    @action
    onKeyDown(event: any) {
        if (event.keyCode == 27) {
            // ESC KEY
            UIStateStore.viewOptions.outputVisible = !UIStateStore.viewOptions.outputVisible;
        }
    }

    render() {
        return (
            <OutputDiv tabIndex={0} onFocus={this.onFocus} onKeyDown={this.onKeyDown.bind(this)}>
                <TabsViewContainer>
                    <TabsView tabs={OutputSectionsStore.sections} />
                </TabsViewContainer>
                <Messages />
            </OutputDiv>
        );
    }
}
