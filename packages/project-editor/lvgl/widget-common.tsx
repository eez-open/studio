import React from "react";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import {
    ClassInfo,
    EezObject,
    getParent,
    IPropertyGridGroupDefinition,
    LVGL_FLAG_CODES,
    LVGL_STATE_CODES,
    PropertyProps,
    PropertyType
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    createObject,
    getAncestorOfType,
    getClassInfo,
    Message,
    propertyNotSetMessage
} from "project-editor/store";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { ProjectContext } from "project-editor/project/context";
import { Checkbox } from "project-editor/lvgl/LVGLStylesDefinitionProperty";
import { humanize } from "eez-studio-shared/string";

////////////////////////////////////////////////////////////////////////////////

export const LV_EVENT_BAR_VALUE_CHANGED = 0x7a;
export const LV_EVENT_BAR_VALUE_START_CHANGED = 0x7b;
export const LV_EVENT_SLIDER_VALUE_CHANGED = 0x7c;
export const LV_EVENT_SLIDER_VALUE_LEFT_CHANGED = 0x7d;
const LV_EVENT_CHECKED = 0x7e;
const LV_EVENT_UNCHECKED = 0x7f;

const LVGL_EVENTS = {
    PRESSED: 1,
    PRESS_LOST: 3,
    RELEASED: 8,
    CLICKED: 7,
    LONG_PRESSED: 5,
    LONG_PRESSED_REPEAT: 6,
    FOCUSED: 14,
    DEFOCUSED: 15,
    VALUE_CHANGED: 28,
    READY: 31,
    CANCEL: 32,
    SCREEN_LOADED: 39,
    SCREEN_UNLOADED: 40,
    SCREEN_LOAD_START: 38,
    SCREEN_UNLOAD_START: 37,
    CHECKED: LV_EVENT_CHECKED,
    UNCHECKED: LV_EVENT_UNCHECKED
};

export type ValuesOf<T extends any[]> = T[number];

function getTriggerEnumItems(
    eventHandlers: EventHandler[],
    eventHandler: EventHandler | undefined
) {
    const eventNames: string[] = eventHandlers
        .filter(eh => eh != eventHandler)
        .map(eventHandler => eventHandler.trigger);
    return Object.keys(LVGL_EVENTS)
        .filter(eventName => eventNames.indexOf(eventName) == -1)
        .map(eventName => ({
            id: eventName,
            label: eventName
        }));
}

export class EventHandler extends EezObject {
    trigger: keyof typeof LVGL_EVENTS;
    handlerType: "flow" | "action";
    action: string;

    constructor() {
        super();

        makeObservable(this, {
            trigger: observable,
            handlerType: observable,
            action: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "trigger",
                type: PropertyType.Enum,
                enumItems: (eventHandler: EventHandler) => {
                    const eventHandlers = getParent(
                        eventHandler
                    ) as EventHandler[];
                    return getTriggerEnumItems(eventHandlers, eventHandler);
                },
                enumDisallowUndefined: true
            },
            {
                name: "handlerType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "flow", label: "Flow" },
                    { id: "action", label: "Action" }
                ],
                enumDisallowUndefined: true,
                readOnlyInPropertyGrid: eventHandler =>
                    !ProjectEditor.getProject(eventHandler).projectTypeTraits
                        .hasFlowSupport
            },
            {
                name: "action",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "actions",
                hideInPropertyGrid: (eventHandler: EventHandler) => {
                    return eventHandler.handlerType != "action";
                }
            }
        ],

        updateObjectValueHook: (eventHandler: EventHandler, values: any) => {
            if (
                values.trigger != undefined &&
                eventHandler.trigger != values.trigger
            ) {
                const widget = getAncestorOfType<LVGLWidget>(
                    eventHandler,
                    ProjectEditor.LVGLWidgetClass.classInfo
                );
                if (widget) {
                    ProjectEditor.getFlow(widget).rerouteConnectionLinesOutput(
                        widget,
                        eventHandler.trigger,
                        values.trigger
                    );
                }
            }
        },

        deleteObjectRefHook: (eventHandler: EventHandler) => {
            const widget = getAncestorOfType<LVGLWidget>(
                eventHandler,
                ProjectEditor.LVGLWidgetClass.classInfo
            )!;

            ProjectEditor.getFlow(widget).deleteConnectionLinesFromOutput(
                widget,
                eventHandler.trigger
            );
        },

        defaultValue: {
            handlerType: "action"
        },

        newItem: async (eventHandlers: EventHandler[]) => {
            const project = ProjectEditor.getProject(eventHandlers);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Event Handler",
                    fields: [
                        {
                            name: "trigger",
                            type: "enum",
                            enumItems: getTriggerEnumItems(
                                eventHandlers,
                                undefined
                            )
                        },
                        {
                            name: "handlerType",
                            type: "enum",
                            enumItems: [
                                { id: "flow", label: "Flow" },
                                { id: "action", label: "Action" }
                            ],
                            visible: () =>
                                project.projectTypeTraits.hasFlowSupport
                        },
                        {
                            name: "action",
                            type: "enum",
                            enumItems: project.actions
                                .filter(
                                    action =>
                                        !project.projectTypeTraits
                                            .hasFlowSupport ||
                                        action.implementationType == "native"
                                )
                                .map(action => ({
                                    id: action.name,
                                    label: action.name
                                })),
                            visible: (values: any) => {
                                return values.handlerType == "action";
                            }
                        }
                    ]
                },
                values: {
                    handlerType: project.projectTypeTraits.hasFlowSupport
                        ? "flow"
                        : "action"
                },
                dialogContext: project
            });

            const properties: Partial<EventHandler> = {
                trigger: result.values.trigger,
                handlerType: result.values.handlerType,
                action: result.values.action
            };

            const eventHandler = createObject<EventHandler>(
                project._DocumentStore,
                properties,
                EventHandler
            );

            return eventHandler;
        },

        check: (eventHandler: EventHandler) => {
            let messages: Message[] = [];

            if (eventHandler.handlerType == "action") {
                if (!eventHandler.action) {
                    messages.push(
                        propertyNotSetMessage(eventHandler, "action")
                    );
                }
                ProjectEditor.documentSearch.checkObjectReference(
                    eventHandler,
                    "action",
                    messages
                );
            }
            return messages;
        }
    };

    get triggerCode() {
        return LVGL_EVENTS[this.trigger];
    }
}

const eventsGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-events",
    title: "Events",
    position: 4
};

export const eventHandlersProperty = {
    name: "eventHandlers",
    type: PropertyType.Array,
    typeClass: EventHandler,
    propertyGridGroup: eventsGroup,
    partOfNavigation: false,
    enumerable: false,
    defaultValue: []
};

////////////////////////////////////////////////////////////////////////////////

export const LVGLWidgetFlagsProperty = observer(
    class LVGLWidgetFlagsProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const flagNames: (keyof typeof LVGL_FLAG_CODES)[] = [];

            this.props.objects.map((widget: LVGLWidget) => {
                const classInfo = getClassInfo(widget);
                for (const flagName of classInfo.lvgl!.flags) {
                    if (flagNames.indexOf(flagName) == -1) {
                        flagNames.push(flagName);
                    }
                }
            });

            return (
                <div>
                    {flagNames.map(flagName => {
                        let values = this.props.objects.map(
                            (widget: LVGLWidget) =>
                                (widget.flags || "")
                                    .split("|")
                                    .indexOf(flagName) != -1
                        );

                        let numEnabled = 0;
                        let numDisabled = 0;
                        values.forEach(value => {
                            if (value) {
                                numEnabled++;
                            } else {
                                numDisabled++;
                            }
                        });

                        let state =
                            numEnabled == 0
                                ? false
                                : numDisabled == 0
                                ? true
                                : undefined;

                        return (
                            <Checkbox
                                key={flagName}
                                state={state}
                                label={humanize(flagName)}
                                onChange={(value: boolean) => {
                                    this.context.undoManager.setCombineCommands(
                                        true
                                    );

                                    if (value) {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.flags.indexOf(
                                                        flagName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

                                                const flagsArr = (
                                                    widget.flags || ""
                                                ).split("|");
                                                if (
                                                    flagsArr.indexOf(
                                                        flagName
                                                    ) == -1
                                                ) {
                                                    flagsArr.push(flagName);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            flags: flagsArr.join(
                                                                "|"
                                                            )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    } else {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.flags.indexOf(
                                                        flagName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

                                                const flagsArr = (
                                                    widget.flags || ""
                                                ).split("|");
                                                const i =
                                                    flagsArr.indexOf(flagName);
                                                if (i != -1) {
                                                    flagsArr.splice(i, 1);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            flags: flagsArr.join(
                                                                "|"
                                                            )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }

                                    this.context.undoManager.setCombineCommands(
                                        false
                                    );
                                }}
                                readOnly={this.props.readOnly}
                            />
                        );
                    })}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const LVGLWidgetStatesProperty = observer(
    class LVGLWidgetStatesProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const stateNames: (keyof typeof LVGL_STATE_CODES)[] = [];

            this.props.objects.map((widget: LVGLWidget) => {
                const classInfo = getClassInfo(widget);
                for (const stateName of classInfo.lvgl!.states) {
                    if (stateNames.indexOf(stateName) == -1) {
                        stateNames.push(stateName);
                    }
                }
            });

            return (
                <div>
                    {stateNames.map(stateName => {
                        let values = this.props.objects.map(
                            (widget: LVGLWidget) =>
                                (widget.states || "")
                                    .split("|")
                                    .indexOf(stateName) != -1
                        );

                        let numEnabled = 0;
                        let numDisabled = 0;
                        values.forEach(value => {
                            if (value) {
                                numEnabled++;
                            } else {
                                numDisabled++;
                            }
                        });

                        let state =
                            numEnabled == 0
                                ? false
                                : numDisabled == 0
                                ? true
                                : undefined;

                        return (
                            <Checkbox
                                key={stateName}
                                state={state}
                                label={humanize(stateName)}
                                onChange={(value: boolean) => {
                                    this.context.undoManager.setCombineCommands(
                                        true
                                    );

                                    if (value) {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.states.indexOf(
                                                        stateName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

                                                const statesArr = (
                                                    widget.states || ""
                                                ).split("|");
                                                if (
                                                    statesArr.indexOf(
                                                        stateName
                                                    ) == -1
                                                ) {
                                                    statesArr.push(stateName);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            states: statesArr.join(
                                                                "|"
                                                            )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    } else {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.states.indexOf(
                                                        stateName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

                                                const statesArr = (
                                                    widget.states || ""
                                                ).split("|");
                                                const i =
                                                    statesArr.indexOf(
                                                        stateName
                                                    );
                                                if (i != -1) {
                                                    statesArr.splice(i, 1);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            states: statesArr.join(
                                                                "|"
                                                            )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }

                                    this.context.undoManager.setCombineCommands(
                                        false
                                    );
                                }}
                                readOnly={this.props.readOnly}
                            />
                        );
                    })}
                </div>
            );
        }
    }
);
