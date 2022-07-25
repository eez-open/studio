import React from "react";
import { makeObservable } from "mobx";
import { observable, computed, action } from "mobx";

import { guid } from "eez-studio-shared/guid";
import { Icon } from "eez-studio-ui/icon";

import {
    IEezObject,
    getProperty,
    MessageType,
    IMessage
} from "project-editor/core/object";

import {
    getChildOfObject,
    humanizePropertyName
} from "project-editor/store/helper";

import { IPanel } from "project-editor/store/navigation";
import type { ProjectEditorStore } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export enum Section {
    CHECKS,
    OUTPUT,
    SEARCH
}

export class Message implements IMessage {
    id: string = guid();
    selected: boolean = false;

    constructor(
        public type: MessageType,
        public text: string,
        public object?: IEezObject
    ) {
        makeObservable(this, {
            selected: observable
        });
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
        `"${humanizePropertyName(object, propertyName)}": "${getProperty(
            object,
            propertyName
        )}" not found.`,
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

export class OutputSection implements IPanel {
    permanent: boolean = true;

    loading = false;

    messages: Message[] = [];
    selectedMessage: Message | undefined;

    constructor(
        public projectEditorStore: ProjectEditorStore,
        public id: number,
        public name: string,
        public scrollToBottom: boolean,
        public tabId: string
    ) {
        makeObservable(this, {
            loading: observable,
            messages: observable,
            selectedMessage: observable,
            active: computed,
            title: computed,
            numErrors: computed,
            numWarnings: computed,
            clear: action,
            selectedObject: computed,
            selectMessage: action
        });
    }

    get active() {
        return (
            this.projectEditorStore.uiStateStore.activeOutputSection === this.id
        );
    }

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
            (this.projectEditorStore.uiStateStore.searchPattern ||
                this.messages.length > 0)
        ) {
            return `${this.name} (${this.messages.length})`;
        }

        return this.name;
    }

    get numErrors() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.ERROR) {
                n++;
            }
        }
        return n;
    }

    get numWarnings() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.WARNING) {
                n++;
            }
        }
        return n;
    }

    clear() {
        this.messages = [];
        this.selectedMessage = undefined;
    }

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

    selectMessage(message: Message) {
        if (this.selectedMessage !== message) {
            if (this.selectedMessage) {
                this.selectedMessage.selected = false;
            }
            message.selected = true;
            this.selectedMessage = message;
        }

        if (message.object) {
            this.projectEditorStore.navigationStore.showObjects(
                [message.object],
                true,
                true,
                true
            );
        }
    }
}

export class OutputSections {
    sections: OutputSection[] = [];

    constructor(public projectEditorStore: ProjectEditorStore) {
        makeObservable(this, {
            setLoading: action,
            clear: action,
            write: action,
            setMessages: action
        });

        this.sections[Section.CHECKS] = new OutputSection(
            projectEditorStore,
            Section.CHECKS,
            "Checks",
            false,
            "CHECKS"
        );
        this.sections[Section.OUTPUT] = new OutputSection(
            projectEditorStore,
            Section.OUTPUT,
            "Output",
            true,
            "OUTPUT"
        );
        this.sections[Section.SEARCH] = new OutputSection(
            projectEditorStore,
            Section.SEARCH,
            "Search results",
            false,
            "SEARCH_RESULTS"
        );
    }

    getSection(sectionType: Section) {
        return this.sections[sectionType];
    }

    setLoading(sectionType: Section, loading: boolean) {
        this.sections[sectionType].loading = loading;
    }

    clear(sectionType: Section) {
        const section = this.sections[sectionType];
        section.clear();
    }

    write(
        sectionType: Section,
        type: MessageType,
        text: string,
        object?: IEezObject
    ) {
        let section = this.sections[sectionType];
        section.messages.push(new Message(type, text, object));
    }

    setMessages(sectionType: Section, messages: IMessage[]) {
        let section = this.sections[sectionType];
        section.messages = messages as Message[];
    }
}
