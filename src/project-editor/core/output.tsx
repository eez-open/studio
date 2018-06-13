import * as React from "react";
import { observable, action, computed } from "mobx";

import { Icon } from "shared/ui/icon";

import {
    OutputSectionsStore,
    UIStateStore,
    getChildOfObject,
    humanizePropertyName
} from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";
import { generateObjectId } from "project-editor/core/util";

////////////////////////////////////////////////////////////////////////////////

export enum Section {
    CHECKS,
    OUTPUT,
    SEARCH
}

export enum Type {
    INFO,
    ERROR,
    WARNING
}

export class Message {
    id: string = generateObjectId();
    @observable selected: boolean = false;

    constructor(public type: Type, public text: string, public object?: EezObject) {}
}

export class OutputSection {
    @observable active: boolean;
    permanent: boolean = true;

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

                    {this.numErrors === 0 &&
                        this.numWarnings === 0 && (
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
            if (this.messages[i].type == Type.ERROR) {
                n++;
            }
        }
        return n;
    }

    @computed
    get numWarnings() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == Type.WARNING) {
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
        return this.selectedMessage && this.selectedMessage.object;
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
    clear(sectionType: Section) {
        this.sections[sectionType].clear();
    }

    @action
    write(sectionType: Section, type: Type, text: string, object?: EezObject) {
        let section = this.sections[sectionType];
        section.messages.push(new Message(type, text, object));
    }

    @action
    setMessages(sectionType: Section, messages: Message[]) {
        let section = this.sections[sectionType];
        section.messages = messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function propertyNotSetMessage(
    object: EezObject,
    propertyName: string,
    type: Type = Type.ERROR
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
    type: Type = Type.ERROR
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
    type: Type = Type.ERROR
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
    type: Type = Type.ERROR
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
    type: Type = Type.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": invalid value.`,
        getChildOfObject(object, propertyName)
    );
}
