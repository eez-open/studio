import { observer } from "mobx-react";
import React from "react";

import { Icon } from "eez-studio-ui/icon";

import { humanize } from "eez-studio-shared/string";

import {
    IPanel,
    Message as OutputMessage,
    OutputSection,
    getObjectIcon
} from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";
import {
    MessageType,
    getParent,
    getProperty,
    getKey
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Message, Section } from "project-editor/store/output-sections";
import { findAllOccurrences } from "project-editor/core/search";
import { EezValueObject } from "project-editor/store";

const MAX_OUTPUT_MESSAGE_TEXT_SIZE = 1000;

////////////////////////////////////////////////////////////////////////////////

export const Messages = observer(
    class Messages
        extends React.Component<{
            section: OutputSection;
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
            this.context.navigationStore.mountPanel(this);

            this.ensureSelectionVisible();
        }

        componentDidUpdate() {
            this.ensureSelectionVisible();
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
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
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };
        //

        get rootNode(): ITreeNode<Message> {
            const section = this.props.section;
            const selectedItemID = this.props.section.selectedMessage?.id;

            function getChildren(messages: Message[]): ITreeNode<Message>[] {
                return messages.map(message => ({
                    id: message.id,
                    label: (
                        <MessageContent section={section} message={message} />
                    ),
                    children: message.messages
                        ? getChildren(message.messages)
                        : [],
                    selected: selectedItemID == message.id,
                    selectable:
                        !section.showsSearchResults ||
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
                (!this.props.section.showsSearchResults ||
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
            section: OutputSection;
            message: OutputMessage;
        },
        {}
    > {
        render() {
            let icon;

            if (this.props.section.showsSearchResults) {
                if (this.props.message.object) {
                    let iconName;

                    if (this.props.message.type == MessageType.SEARCH_RESULT) {
                        iconName = "material:search";
                    } else {
                        iconName = getObjectIcon(this.props.message.object);
                    }

                    if (iconName) {
                        icon = (
                            <Icon
                                icon={iconName}
                                className={"info"}
                                size={18}
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
                    ? this.props.message.text
                    : (this.props.message.text as any)?.toString() ?? "";

            if (text.length > MAX_OUTPUT_MESSAGE_TEXT_SIZE) {
                text = text.substring(0, MAX_OUTPUT_MESSAGE_TEXT_SIZE) + "...";
            }

            const style: React.CSSProperties = {};

            if (
                this.props.section.showsSearchResults &&
                this.props.message.type != MessageType.SEARCH_RESULT
            ) {
                style.opacity = "0.7";
            }

            let textNode: React.ReactNode = text;

            const uiStateStore = this.props.section.projectStore.uiStateStore;
            if (
                this.props.section.id == Section.SEARCH &&
                uiStateStore.replaceEnabled &&
                this.props.message.object &&
                this.props.message.object instanceof EezValueObject
            ) {
                const pattern = uiStateStore.searchPattern;
                const replace = uiStateStore.replaceText;

                const key = getKey(this.props.message.object);

                const str = `${getProperty(
                    getParent(this.props.message.object),
                    key
                )}`;

                const occurrences = findAllOccurrences(
                    str,
                    pattern,
                    uiStateStore.searchMatchCase,
                    uiStateStore.searchMatchWholeWord
                );

                let parts: {
                    type: "same" | "removed" | "added";
                    str: string;
                }[] = [];

                parts.unshift({
                    type: "same",
                    str: humanize(key) + ": "
                });

                let end = 0;

                for (const occurrence of occurrences) {
                    if (end < occurrence.start) {
                        parts.push({
                            type: "same",
                            str: str.substring(end, occurrence.start)
                        });
                    }

                    parts.push({
                        type: "removed",
                        str: str.substring(occurrence.start, occurrence.end)
                    });

                    parts.push({ type: "added", str: replace });

                    end = occurrence.end;
                }

                if (end < str.length) {
                    parts.push({ type: "same", str: str.substring(end) });
                }

                textNode = parts.map((part, i) => (
                    <span key={i} className={part.type}>
                        {part.str}
                    </span>
                ));
            }

            return (
                <span className="EezStudio_Message" style={style}>
                    {icon}
                    <span>{textNode}</span>
                </span>
            );
        }
    }
);
