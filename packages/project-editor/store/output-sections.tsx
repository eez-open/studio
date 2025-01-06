import React from "react";
import { makeObservable, observable, computed, action } from "mobx";

import { guid } from "eez-studio-shared/guid";
import { Icon } from "eez-studio-ui/icon";

import {
    IEezObject,
    getProperty,
    MessageType,
    IMessage,
    PropertyInfo,
    getParent,
    getKey,
    EezObject,
    LVGLParts
} from "project-editor/core/object";

import {
    EezValueObject,
    getChildOfObject,
    getObjectPath,
    getObjectPathAsString,
    humanizePropertyName
} from "project-editor/store/helper";

import { ProjectStore, getLabel } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

import type { LVGLStylesDefinition } from "project-editor/lvgl/style-definition";

import { isArray } from "eez-studio-shared/util";
import {
    LVGLPropertyInfo,
    isLvglStylePropertySupported
} from "project-editor/lvgl/style-catalog";

////////////////////////////////////////////////////////////////////////////////

export enum Section {
    CHECKS,
    OUTPUT,
    SEARCH,
    REFERENCES
}

export class Message implements IMessage {
    _id: string = guid();
    selected: boolean = false;

    constructor(
        public type: MessageType,
        public text: string,
        public object?: IEezObject,
        public messages?: Message[],
        public useGeneratedId?: boolean
    ) {
        makeObservable(this, {
            selected: observable,
            messages: observable
        });
    }

    get id() {
        if (this.useGeneratedId) {
            return this._id;
        }
        return this.object ? getObjectPathAsString(this.object) : this._id;
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

export class MessagesCollection {
    messages: Message[] = [];

    groupMessagesStack: Message[] = [];

    constructor() {
        makeObservable(this, {
            messages: observable,
            searchResults: computed,
            numErrors: computed,
            numWarnings: computed,
            openGroup: action,
            push: action,
            closeGroup: action,
            pushAsTree: action,
            setMessages: action,
            clear: action
        });
    }

    get searchResults() {
        const searchResults: Message[] = [];

        function findAll(messages: Message[]) {
            for (const message of messages) {
                if (message.type == MessageType.GROUP) {
                    findAll(message.messages!);
                } else if (message.type == MessageType.SEARCH_RESULT) {
                    searchResults.push(message);
                }
            }
        }

        findAll(this.messages);

        return searchResults;
    }

    get numErrors(): number {
        let n = 0;

        function count(messages: Message[]) {
            for (const message of messages) {
                if (message.type == MessageType.GROUP) {
                    count(message.messages!);
                } else if (message.type == MessageType.ERROR) {
                    n++;
                }
            }
        }

        count(this.messages);

        return n;
    }

    get numWarnings() {
        let n = 0;

        function count(messages: Message[]) {
            for (const message of messages) {
                if (message.type == MessageType.GROUP) {
                    count(message.messages!);
                } else if (message.type == MessageType.WARNING) {
                    n++;
                }
            }
        }

        count(this.messages);

        return n;
    }

    openGroup(message: Message) {
        this.groupMessagesStack.push(message);
    }

    push(message: Message) {
        if (this.groupMessagesStack.length > 0) {
            this.groupMessagesStack[
                this.groupMessagesStack.length - 1
            ].messages!.push(message);
        } else {
            this.messages.push(message);
        }
    }

    closeGroup(showEmptyGroup: boolean) {
        const groupMessage =
            this.groupMessagesStack[this.groupMessagesStack.length - 1];

        this.groupMessagesStack.splice(this.groupMessagesStack.length - 1, 1);

        if (groupMessage.messages!.length > 0 || showEmptyGroup) {
            this.push(groupMessage);
        }
    }

    pushAsTree(message: Message) {
        const messageObject = message.object;
        if (!messageObject) {
            this.push(message);
            return;
        }

        let messages = this.messages;

        const project = ProjectEditor.getProject(messageObject);

        const path = getObjectPath(
            messageObject instanceof EezValueObject
                ? getParent(messageObject)
                : messageObject
        );

        let groupObject: any = project;
        for (const part of path) {
            groupObject = groupObject[part];
            if (!groupObject) {
                break;
            }

            if (
                groupObject instanceof EezValueObject ||
                !(isArray(groupObject) || groupObject instanceof EezObject)
            ) {
                break;
            }

            const groupMessage = messages.find(
                message =>
                    message.type == MessageType.GROUP &&
                    message.object == groupObject
            );

            if (groupMessage) {
                messages = groupMessage.messages!;
            } else {
                let label = getLabel(groupObject);

                const message = new Message(
                    MessageType.GROUP,
                    label,
                    groupObject,
                    []
                );

                messages.push(message);
                messages = message.messages!;
            }
        }

        messages.push(message);
    }

    setMessages(messages: Message[]) {
        this.messages = messages;
    }

    clear() {
        this.messages = [];
    }

    isPropertyInError(object: IEezObject, propertyInfo: PropertyInfo) {
        function test(messages: Message[]) {
            for (const message of messages) {
                if (message.type == MessageType.GROUP) {
                    if (test(message.messages!)) {
                        return true;
                    }
                } else if (
                    message.object &&
                    getParent(message.object) === object &&
                    getKey(message.object) === propertyInfo.name
                ) {
                    return true;
                }
            }

            return false;
        }

        return test(this.messages);
    }

    isLVGLStylePropertyInError(
        object: LVGLStylesDefinition,
        part: LVGLParts,
        state?: string,
        propertyInfoArray?: LVGLPropertyInfo[]
    ) {
        function test(messages: Message[]) {
            for (const message of messages) {
                if (message.type == MessageType.GROUP) {
                    if (test(message.messages!)) {
                        return true;
                    }
                } else if (
                    message.object &&
                    getParent(message.object) === object
                ) {
                    const messageObjectKey = getKey(message.object);
                    return keys.find(key => messageObjectKey.startsWith(key));
                }
            }

            return false;
        }

        const keys = propertyInfoArray
            ? propertyInfoArray
                  .filter(propertyInfo =>
                      isLvglStylePropertySupported(object, propertyInfo)
                  )
                  .map(
                      propertyInfo =>
                          `definition.${part}${state ? `.${state}` : ""}${
                              propertyInfo ? `.${propertyInfo.name}` : ""
                          }`
                  )
            : [`definition.${part}${state ? `.${state}` : ""}`];

        return test(this.messages);
    }
}

export class OutputSection {
    permanent: boolean = true;

    loading = false;

    messages = new MessagesCollection();
    selectedMessage: Message | undefined;

    constructor(
        public projectStore: ProjectStore,
        public id: Section,
        public name: string,
        public tabId: string
    ) {
        makeObservable(this, {
            loading: observable,
            selectedMessage: observable,
            active: computed,
            title: computed,
            clear: action,
            selectedObject: computed,
            selectMessage: action
        });
    }

    get showsSearchResults() {
        return this.id == Section.SEARCH || this.id == Section.REFERENCES;
    }

    get active() {
        return this.projectStore.uiStateStore.activeOutputSection === this.id;
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
            (this.projectStore.uiStateStore.searchPattern ||
                this.messages.searchResults.length > 0)
        ) {
            return `${this.name} (${this.messages.searchResults.length})`;
        }

        if (
            this.id == Section.REFERENCES &&
            this.messages.searchResults.length > 0
        ) {
            return `${this.name} (${this.messages.searchResults.length})`;
        }

        return this.name;
    }

    get numErrors() {
        return this.messages.numErrors;
    }

    get numWarnings() {
        return this.messages.numWarnings;
    }

    clear() {
        this.messages.clear();
        this.selectedMessage = undefined;
    }

    get selectedObject(): IEezObject | undefined {
        return this.selectedMessage?.object;
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
            this.projectStore.navigationStore.showObjects(
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

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            setLoading: action,
            clear: action,
            write: action,
            setMessages: action
        });

        this.sections[Section.CHECKS] = new OutputSection(
            projectStore,
            Section.CHECKS,
            "Checks",
            "CHECKS"
        );
        this.sections[Section.OUTPUT] = new OutputSection(
            projectStore,
            Section.OUTPUT,
            "Output",
            "OUTPUT"
        );
        this.sections[Section.SEARCH] = new OutputSection(
            projectStore,
            Section.SEARCH,
            "Search",
            "SEARCH"
        );
        this.sections[Section.REFERENCES] = new OutputSection(
            projectStore,
            Section.REFERENCES,
            "References",
            "REFERENCES"
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

    openGroup(sectionType: Section, text: string) {
        let section = this.sections[sectionType];

        section.messages.openGroup(
            new Message(MessageType.GROUP, text, undefined, [])
        );
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

    closeGroup(sectionType: Section, showEmptyGroup: boolean) {
        let section = this.sections[sectionType];
        section.messages.closeGroup(showEmptyGroup);
    }

    writeAsTree(
        sectionType: Section,
        type: MessageType,
        text: string,
        object?: IEezObject
    ) {
        let section = this.sections[sectionType];
        section.messages.pushAsTree(new Message(type, text, object));
    }

    setMessages(sectionType: Section, messages: IMessage[]) {
        let section = this.sections[sectionType];
        section.messages.setMessages(messages as Message[]);
    }
}
