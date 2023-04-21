import { observer } from "mobx-react";
import React from "react";

import { Icon } from "eez-studio-ui/icon";

import {
    IPanel,
    Message as OutputMessage,
    OutputSection,
    getClassInfo
} from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";
import { MessageType } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Message } from "project-editor/store/output-sections";

const MAX_OUTPUT_MESSAGE_TEXT_SIZE = 100;

////////////////////////////////////////////////////////////////////////////////

export const Messages = observer(
    class Messages
        extends React.Component<{
            section: OutputSection;
            showSearchResults?: boolean;
        }>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        divRef = React.createRef<HTMLDivElement>();

        onSelectMessage = (message: OutputMessage) => {
            this.props.section.selectMessage(message);
        };

        componentDidMount() {
            this.context.navigationStore.setInitialSelectedPanel(this);
            this.ensureSelectionVisible();
        }

        componentDidUpdate() {
            this.ensureSelectionVisible();
        }

        ensureSelectionVisible() {
            const id = this.props.section.selectedMessage?.id;
            if (this.props.section.selectedMessage?.id) {
                const el = this.divRef.current?.querySelector(
                    `[data-object-id="${id}"]`
                );
                if (el) {
                    el.scrollIntoView({
                        block: "nearest",
                        behavior: "auto"
                    });
                }
            }
        }

        // interface IPanel implementation
        get selectedObject() {
            const object = this.props.section.selectedMessage?.object;
            if (object) {
                return ProjectEditor.getNavigationObject(object);
            }
            return object;
        }
        cutSelection() {}
        copySelection() {}
        pasteSelection() {}
        deleteSelection() {}
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };
        //

        get rootNode(): ITreeNode<Message> {
            const showSearchResults = this.props.showSearchResults;
            const selectedItemID = this.props.section.selectedMessage?.id;

            function getChildren(messages: Message[]): ITreeNode<Message>[] {
                return messages.map(message => ({
                    id: message.id,
                    label: (
                        <MessageContent
                            message={message}
                            showSearchResults={showSearchResults}
                        />
                    ),
                    children: message.messages
                        ? getChildren(message.messages)
                        : [],
                    selected: selectedItemID == message.id,
                    selectable:
                        !showSearchResults ||
                        message.type == MessageType.SEARCH_RESULT,
                    expanded: true,
                    data: message
                }));
            }

            return {
                id: "root",
                label: "",
                children: getChildren(this.props.section.messages.messages),
                selected: false,
                selectable: false,
                expanded: true,
                data: undefined
            };
        }

        selectNode = (node: ITreeNode<Message>) => {
            if (
                node.data &&
                (!this.props.showSearchResults ||
                    node.data.type == MessageType.SEARCH_RESULT)
            ) {
                this.onSelectMessage(node.data);
            }
        };

        render() {
            return (
                <div
                    ref={this.divRef}
                    className="EezStudio_Messages"
                    onFocus={this.onFocus}
                    tabIndex={0}
                >
                    <Tree
                        rootNode={this.rootNode}
                        selectNode={this.selectNode}
                        showOnlyChildren={true}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const MessageContent = observer(
    class MessageContent extends React.Component<
        {
            message: OutputMessage;
            showSearchResults?: boolean;
        },
        {}
    > {
        render() {
            let icon;

            if (this.props.showSearchResults) {
                if (this.props.message.object) {
                    let iconName;

                    if (this.props.message.type == MessageType.SEARCH_RESULT) {
                        iconName = "material:search";
                    } else {
                        iconName = getClassInfo(this.props.message.object).icon;
                    }

                    if (iconName) {
                        icon = (
                            <Icon
                                icon={iconName}
                                className={"info"}
                                size={20}
                            />
                        );
                    }
                }
            } else {
                let iconName = "material:";
                let iconClassName;
                if (this.props.message.type == MessageType.ERROR) {
                    iconName += "error";
                    iconClassName = "error";
                } else if (this.props.message.type == MessageType.WARNING) {
                    iconName += "warning";
                    iconClassName = "warning";
                } else if (this.props.message.type == MessageType.INFO) {
                    iconName += "info";
                    iconClassName = "info";
                } else {
                    iconName += "folder";
                    iconClassName = "folder";
                }
                icon = <Icon icon={iconName} className={iconClassName} />;
            }

            let text =
                typeof this.props.message.text == "string"
                    ? this.props.message.text.toString()
                    : this.props.message.text;
            if (text.length > MAX_OUTPUT_MESSAGE_TEXT_SIZE) {
                text = text.substring(0, MAX_OUTPUT_MESSAGE_TEXT_SIZE) + "...";
            }

            const style: React.CSSProperties = {};

            if (
                this.props.showSearchResults &&
                this.props.message.type != MessageType.SEARCH_RESULT
            ) {
                style.opacity = "0.7";
            }

            return (
                <span style={style}>
                    {icon} {text}
                </span>
            );
        }
    }
);
