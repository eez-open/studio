import React from "react";
import { observable, action, computed } from "mobx";

import { guid } from "eez-studio-shared/guid";

import { Icon } from "eez-studio-ui/icon";

import {
    IEezObject,
    IMessage,
    MessageType,
    getChildOfObject,
    humanizePropertyName
} from "project-editor/core/object";

import type { DocumentStoreClass, IPanel } from "project-editor/core/store";

export { MessageType as Type } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

export enum Section {
    CHECKS,
    OUTPUT,
    SEARCH,
    DEBUG
}

export class Message implements IMessage {
    id: string = guid();
    @observable selected: boolean = false;

    constructor(
        public type: MessageType,
        public text: string,
        public object?: IEezObject
    ) {}
}

export class OutputSection implements IPanel {
    permanent: boolean = true;

    @observable loading = false;

    @observable messages: Message[] = [];
    @observable selectedMessage: Message | undefined;

    constructor(
        public DocumentStore: DocumentStoreClass,
        public id: number,
        public name: string,
        public scrollToBottom: boolean
    ) {}

    @computed get active() {
        return this.DocumentStore.UIStateStore.activeOutputSection === this.id;
    }

    @computed
    get title(): string | React.ReactNode {
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

        if (
            this.id == Section.SEARCH &&
            (this.DocumentStore.UIStateStore.searchPattern ||
                this.messages.length > 0)
        ) {
            return `${this.name} (${this.messages.length})`;
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
    get selectedObject(): IEezObject | undefined {
        return this.selectedMessage &&
            this.messages.indexOf(this.selectedMessage) !== -1
            ? this.selectedMessage.object
            : undefined;
    }

    cutSelection() {
        // TODO
    }

    copySelection() {
        // TODO
    }

    pasteSelection() {
        // TODO
    }

    deleteSelection() {
        // TODO
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
        this.DocumentStore.OutputSectionsStore.setActiveSection(this.id);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class OutputSections {
    sections: OutputSection[] = [];

    constructor(public DocumentStore: DocumentStoreClass) {
        this.sections[Section.CHECKS] = new OutputSection(
            DocumentStore,
            Section.CHECKS,
            "Checks",
            false
        );
        this.sections[Section.OUTPUT] = new OutputSection(
            DocumentStore,
            Section.OUTPUT,
            "Output",
            true
        );
        this.sections[Section.SEARCH] = new OutputSection(
            DocumentStore,
            Section.SEARCH,
            "Search results",
            false
        );
        this.sections[Section.DEBUG] = new OutputSection(
            DocumentStore,
            Section.DEBUG,
            "Debug",
            false
        );
    }

    @computed get activeSection() {
        return (
            this.sections[
                this.DocumentStore.UIStateStore.activeOutputSection
            ] ?? this.sections[Section.CHECKS]
        );
    }

    getSection(sectionType: Section) {
        return this.sections[sectionType];
    }

    @action
    setActiveSection(sectionType: Section) {
        this.DocumentStore.UIStateStore.activeOutputSection = sectionType;
        this.DocumentStore.UIStateStore.viewOptions.outputVisible = true;
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
    write(
        sectionType: Section,
        type: MessageType,
        text: string,
        object?: IEezObject
    ) {
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
    object: IEezObject,
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
    object: IEezObject,
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
    object: IEezObject,
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
    object: IEezObject,
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
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": invalid value.`,
        getChildOfObject(object, propertyName)
    );
}
