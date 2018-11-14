import { action } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";

import { Icon } from "eez-studio-shared/ui/icon";
import { TabsView } from "eez-studio-shared/ui/tabs";

import { UIStateStore, OutputSectionsStore, NavigationStore } from "project-editor/core/store";
import { Message as OutputMessage, Type as MessageType } from "project-editor/core/output";

import { ObjectPath } from "project-editor/components/ObjectPath";

const MAX_OUTPUT_MESSAGE_TEXT_SIZE = 100;

////////////////////////////////////////////////////////////////////////////////

@observer
class Message extends React.Component<
    {
        message: OutputMessage;
        onSelect: (message: OutputMessage) => void;
    },
    {}
> {
    render() {
        let className = "EezStudio_ProjectEditor_output-messages__item";
        if (this.props.message.selected) {
            className += " selected";
        }

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

        return (
            <tr className={className} onClick={() => this.props.onSelect(this.props.message)}>
                <td>
                    {icon} {text}
                </td>
                <td>{objectPath}</td>
            </tr>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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
            <table className="EezStudio_ProjectEditor_output-messages">
                <tbody>{rows}</tbody>
            </table>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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
            <div
                className="EezStudio_ProjectEditor_outputs layoutCenter"
                tabIndex={0}
                onFocus={this.onFocus}
                onKeyDown={this.onKeyDown.bind(this)}
            >
                <div className="layoutTop">
                    <TabsView tabs={OutputSectionsStore.sections} />
                </div>
                <div className="layoutCenter" style={{ overflow: "auto" }}>
                    <Messages />
                </div>
            </div>
        );
    }
}
