import { observable, makeObservable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

import {
    IPanel,
    Message as OutputMessage,
    objectToString,
    OutputSection
} from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";
import {
    getAncestors,
    IEezObject,
    MessageType
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";

const MAX_OUTPUT_MESSAGE_TEXT_SIZE = 100;
const MAX_OUTPUT_PATH_PART_TEXT_SIZE = 25;

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

        private divRef = React.createRef<any>();

        rows: React.ReactNode[];

        onSelectMessage = (message: OutputMessage) => {
            this.props.section.selectMessage(message);
        };

        constructor(props: { section: OutputSection }) {
            super(props);

            makeObservable(this, {
                rows: observable
            });
        }

        scrollToBottom() {
            if (this.divRef.current && this.props.section.scrollToBottom) {
                const div: HTMLDivElement = this.divRef.current;
                div.scrollTop = div.scrollHeight;
            }
        }

        componentDidUpdate() {
            this.scrollToBottom();
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

        render() {
            return (
                <div
                    className="EezStudio_Messages"
                    ref={this.divRef}
                    onFocus={this.onFocus}
                    tabIndex={0}
                >
                    <table>
                        <tbody>
                            {this.props.section.messages.map(message => (
                                <Message
                                    key={message.id}
                                    message={message}
                                    onSelect={this.onSelectMessage}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Message = observer(
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

            let text = this.props.message.text.toString();
            if (text.length > MAX_OUTPUT_MESSAGE_TEXT_SIZE) {
                text = text.substring(0, MAX_OUTPUT_MESSAGE_TEXT_SIZE) + "...";
            }

            let className = classNames({
                selected: this.props.message.selected
            });

            return (
                <tr
                    className={className}
                    onClick={() => this.props.onSelect(this.props.message)}
                >
                    <td title={this.props.message.text}>
                        {icon} {text}
                    </td>
                    <td>{objectPath}</td>
                </tr>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class ObjectPath extends React.Component<
    {
        object: IEezObject;
    },
    {}
> {
    render() {
        let pathComponents: JSX.Element[] = [];

        let ancestors = getAncestors(this.props.object);
        for (let i = 1; i < ancestors.length; i++) {
            let pathPartStr: string;
            try {
                pathPartStr = objectToString(ancestors[i]).toString();
            } catch (err) {
                pathPartStr = "undefined";
            }
            if (pathPartStr.length > MAX_OUTPUT_PATH_PART_TEXT_SIZE) {
                pathPartStr =
                    pathPartStr.substring(0, MAX_OUTPUT_PATH_PART_TEXT_SIZE) +
                    "...";
            }
            pathComponents.push(<span key={i}>{pathPartStr}</span>);
        }

        return (
            <span className="EezStudio_ObjectPathSpan">{pathComponents}</span>
        );
    }
}
