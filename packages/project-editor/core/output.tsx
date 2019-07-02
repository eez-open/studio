import React from "react";
import { observable, action, computed } from "mobx";

import { guid } from "eez-studio-shared/guid";

import { Icon } from "eez-studio-ui/icon";

import {
    EezObject,
    IMessage,
    MessageType,
    getChildOfObject,
    humanizePropertyName
} from "project-editor/core/object";
import { OutputSectionsStore, UIStateStore } from "project-editor/core/store";

export { MessageType as Type } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

export enum Section {
    CHECKS,
    OUTPUT,
    SEARCH
}

export class Message implements IMessage {
    id: string = guid();
    @observable selected: boolean = false;

    constructor(public type: MessageType, public text: string, public object?: EezObject) {}
}

export class OutputSection {
    @observable active: boolean;
    permanent: boolean = true;

    @observable loading = false;

    @observable messages: Message[] = [];
    @observable selectedMessage: Message | undefined;

    constructor(public id: number, public name: string) {}

    @computed
    get title(): string | JSX.Element {
        if (this.id == Section.CHECKS) {
            return (
                <React.Fragment>
                    <span className="title">{this.name}</span>

                    {this.numErrors > 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:error" className="error" />
                            <span>{this.numErrors}</span>
                        </React.Fragment>
                    )}

                    {this.numWarnings > 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:warning" className="warning" />
                            <span>{this.numWarnings}</span>
                        </React.Fragment>
                    )}

                    {this.numErrors === 0 && this.numWarnings === 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:check" className="info" />
                        </React.Fragment>
                    )}
                </React.Fragment>
            );
        }

        return this.name;
    }

    @computed
    get numErrors() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.ERROR) {
                n++;
            }
        }
        return n;
    }

    @computed
    get numWarnings() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.WARNING) {
                n++;
            }
        }
        return n;
    }

    @action
    clear() {
        this.messages = [];
        this.selectedMessage = undefined;
    }

    @computed
    get selectedObject(): EezObject | undefined {
        return this.selectedMessage && this.messages.indexOf(this.selectedMessage) !== -1
            ? this.selectedMessage.object
            : undefined;
    }

    @action
    selectMessage(message: Message) {
        if (this.selectedMessage !== message) {
            if (this.selectedMessage) {
                this.selectedMessage.selected = false;
            }
            message.selected = true;
            this.selectedMessage = message;
        }
    }

    makeActive(): void {
        OutputSectionsStore.setActiveSection(this.id);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class OutputSections {
    sections: OutputSection[] = [];
    @observable activeSection: OutputSection;

    constructor() {
        this.sections[Section.CHECKS] = new OutputSection(Section.CHECKS, "Checks");
        this.sections[Section.OUTPUT] = new OutputSection(Section.OUTPUT, "Output");
        this.sections[Section.SEARCH] = new OutputSection(Section.SEARCH, "Search results");
        this.activeSection = this.sections[Section.CHECKS];
        this.activeSection.active = true;
    }

    getSection(sectionType: Section) {
        return this.sections[sectionType];
    }

    @action
    setActiveSection(sectionType: Section) {
        UIStateStore.viewOptions.outputVisible = true;
        this.activeSection.active = false;
        this.activeSection = this.sections[sectionType];
        this.activeSection.active = true;
    }

    @action
    setLoading(sectionType: Section, loading: boolean) {
        this.sections[sectionType].loading = loading;
    }

    @action
    clear(sectionType: Section) {
        this.sections[sectionType].clear();
    }

    @action
    write(sectionType: Section, type: MessageType, text: string, object?: EezObject) {
        let section = this.sections[sectionType];
        section.messages.push(new Message(type, text, object));
    }

    @action
    setMessages(sectionType: Section, messages: IMessage[]) {
        let section = this.sections[sectionType];
        section.messages = messages as Message[];
    }
}

////////////////////////////////////////////////////////////////////////////////

export function propertyNotSetMessage(
    object: EezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": not set.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyNotUniqueMessage(
    object: EezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": is not unique.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertySetButNotUsedMessage(
    object: EezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": set but not used.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyNotFoundMessage(
    object: EezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": not found.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyInvalidValueMessage(
    object: EezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": invalid value.`,
        getChildOfObject(object, propertyName)
    );
}
