import React from "react";
import { observable, makeObservable, runInAction, computed } from "mobx";
import type mqtt from "mqtt";

import {
    GenericDialogResult,
    showGenericDialog
} from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import * as notification from "eez-studio-ui/notification";

import {
    IObjectVariableValue,
    ValueType,
    registerObjectVariableType,
    registerSystemStructure
} from "project-editor/features/variable/value-type";
import type {
    IFlowContext,
    IVariable
} from "project-editor/flow/flow-interfaces";
import {
    registerClass,
    makeDerivedClassInfo,
    PropertyType,
    EezObject,
    ClassInfo,
    IMessage,
    IEezObject
} from "project-editor/core/object";
import {
    ActionComponent,
    makeAssignableExpressionProperty,
    makeExpressionProperty
} from "project-editor/flow/component";
import {
    COMPONENT_TYPE_MQTT_CONNECT,
    COMPONENT_TYPE_MQTT_DISCONNECT,
    COMPONENT_TYPE_MQTT_EVENT,
    COMPONENT_TYPE_MQTT_INIT,
    COMPONENT_TYPE_MQTT_PUBLISH,
    COMPONENT_TYPE_MQTT_SUBSCRIBE,
    COMPONENT_TYPE_MQTT_UNSUBSCRIBE
} from "project-editor/flow/components/component-types";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { isDashboardProject } from "project-editor/project/project-type-traits";
import {
    createObject,
    getAncestorOfType,
    propertyNotSetMessage
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { evalConstantExpression } from "project-editor/flow/expression";
import { Assets, DataBuffer } from "project-editor/build/assets";
import { sendMqttEvent } from "project-editor/flow/runtime/wasm-worker";

////////////////////////////////////////////////////////////////////////////////

const componentHeaderColor = "#B1A6CE";

const MQTT_ICON = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-3 -3 30 30"
        fill="currentColor"
    >
        <path d="M10.657 23.994h-9.45A1.212 1.212 0 0 1 0 22.788v-9.18h.071c5.784 0 10.504 4.65 10.586 10.386Zm7.606 0h-4.045C14.135 16.246 7.795 9.977 0 9.942V6.038h.071c9.983 0 18.121 8.044 18.192 17.956Zm4.53 0h-.97C21.754 12.071 11.995 2.407 0 2.372v-1.16C0 .55.544.006 1.207.006h7.64C15.733 2.49 21.257 7.789 24 14.508v8.291c0 .663-.544 1.195-1.207 1.195ZM16.713.006h6.092A1.19 1.19 0 0 1 24 1.2v5.914c-.91-1.242-2.046-2.65-3.158-3.762C19.588 2.11 18.122.987 16.714.005Z" />
    </svg>
);

const MQTT_MESSAGE_STRUCT_NAME = "$MQTTMessage";

registerSystemStructure({
    name: MQTT_MESSAGE_STRUCT_NAME,
    fields: [
        {
            name: "topic",
            type: "string"
        },
        {
            name: "payload",
            type: "string"
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class MQTTInitActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_MQTT_INIT,
        properties: [
            makeAssignableExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:MQTTConnection"
            ),
            makeExpressionProperty(
                {
                    name: "protocol",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    formText: (object: IEezObject) => `"mqtt" or "mqtts"`
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "host",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "port",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "userName",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    isOptional: true
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "password",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    isOptional: true
                },
                "string"
            )
        ],
        defaultValue: {
            protocol: `"mqtt"`,
            port: 1883,
            userName: `""`,
            password: `""`
        },
        icon: MQTT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "MQTT"
    });

    connection: string;
    protocol: string;
    host: string;
    port: string;
    userName: string;
    password: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable,
            protocol: observable,
            host: observable,
            port: observable,
            userName: observable,
            password: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    get url() {
        let protocol;

        if (isDashboardProject(this)) {
            try {
                protocol = evalConstantExpression(
                    ProjectEditor.getProject(this),
                    this.protocol
                ).value;
            } catch (err) {
                protocol = undefined;
            }
        } else {
            protocol = "mqtt";
        }

        if (!protocol) {
            return undefined;
        }

        let host;
        try {
            host = evalConstantExpression(
                ProjectEditor.getProject(this),
                this.host
            ).value;
        } catch (err) {
            host = undefined;
        }

        if (!this.host) {
            return undefined;
        }

        let port;
        try {
            port = evalConstantExpression(
                ProjectEditor.getProject(this),
                this.port
            ).value;
        } catch (err) {
            port = undefined;
        }

        if (!this.port) {
            return undefined;
        }

        return `${protocol}://${host}:${port}`;
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.connection &&
            this.url && (
                <div className="body">
                    <pre>
                        {this.connection}: {this.url}
                    </pre>
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MQTTConnectActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_MQTT_CONNECT,
        properties: [
            makeExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:MQTTConnection"
            )
        ],
        icon: MQTT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "MQTT"
    });

    connection: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.connection && (
                <div className="body">
                    <pre>{this.connection}</pre>
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MQTTDisconnectActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_MQTT_DISCONNECT,
        properties: [
            makeExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:MQTTConnection"
            )
        ],
        icon: MQTT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "MQTT"
    });

    connection: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.connection && (
                <div className="body">
                    <pre>{this.connection}</pre>
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const MQTT_EVENTS = [
    { id: "connect", label: "Connect", paramExpressionType: "null" },
    { id: "reconnect", label: "Reconnect", paramExpressionType: "null" },
    { id: "close", label: "Close", paramExpressionType: "null" },
    { id: "disconnect", label: "Disconnect", paramExpressionType: "null" },
    { id: "offline", label: "Offline", paramExpressionType: "null" },
    { id: "end", label: "End", paramExpressionType: "null" },
    { id: "error", label: "Error", paramExpressionType: "string" },
    {
        id: "message",
        label: "Message",
        paramExpressionType: "struct:$MQTTMessage"
    }
];

class EventHandler extends EezObject {
    eventName: string;
    handlerType: "flow" | "action";
    action: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            eventName: observable,
            handlerType: observable,
            action: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "eventName",
                displayName: "Event",
                type: PropertyType.Enum,
                enumItems: (eventHandler: EventHandler) => {
                    const component =
                        getAncestorOfType<MQTTEventActionComponent>(
                            eventHandler,
                            MQTTEventActionComponent.classInfo
                        )!;

                    const eventEnumItems = MQTT_EVENTS.filter(
                        event =>
                            event.id == eventHandler.eventName ||
                            !component.eventHandlers.find(
                                eventHandler =>
                                    eventHandler.eventName == event.id
                            )
                    );

                    return eventEnumItems;
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
                disabled: eventHandler =>
                    !ProjectEditor.getProject(eventHandler).projectTypeTraits
                        .hasFlowSupport
            },
            {
                name: "action",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "actions",
                disabled: (eventHandler: EventHandler) => {
                    return eventHandler.handlerType != "action";
                }
            }
        ],

        listLabel: (eventHandler: EventHandler, collapsed) =>
            !collapsed
                ? ""
                : `${eventHandler.eventName} ${eventHandler.handlerType}${
                      eventHandler.handlerType == "action"
                          ? `: ${eventHandler.action}`
                          : ""
                  }`,

        updateObjectValueHook: (
            eventHandler: EventHandler,
            values: Partial<EventHandler>
        ) => {
            if (
                values.handlerType == "action" &&
                eventHandler.handlerType == "flow"
            ) {
                const component = getAncestorOfType<MQTTEventActionComponent>(
                    eventHandler,
                    MQTTEventActionComponent.classInfo
                )!;

                ProjectEditor.getFlow(
                    component
                ).deleteConnectionLinesFromOutput(
                    component,
                    eventHandler.eventName
                );
            } else if (
                values.eventName != undefined &&
                eventHandler.eventName != values.eventName
            ) {
                const component = getAncestorOfType<MQTTEventActionComponent>(
                    eventHandler,
                    MQTTEventActionComponent.classInfo
                );
                if (component) {
                    ProjectEditor.getFlow(
                        component
                    ).rerouteConnectionLinesOutput(
                        component,
                        eventHandler.eventName,
                        values.eventName
                    );
                }
            }
        },

        deleteObjectRefHook: (eventHandler: EventHandler) => {
            const component = getAncestorOfType<MQTTEventActionComponent>(
                eventHandler,
                MQTTEventActionComponent.classInfo
            )!;

            ProjectEditor.getFlow(component).deleteConnectionLinesFromOutput(
                component,
                eventHandler.eventName
            );
        },

        defaultValue: {
            handlerType: "flow"
        },

        newItem: async (eventHandlers: EventHandler[]) => {
            const project = ProjectEditor.getProject(eventHandlers);

            const eventEnumItems = MQTT_EVENTS.filter(
                event =>
                    !eventHandlers.find(
                        eventHandler => eventHandler.eventName == event.id
                    )
            );

            if (eventEnumItems.length == 0) {
                notification.info("All event handlers are already defined");
                return;
            }

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Event Handler",
                    fields: [
                        {
                            name: "eventName",
                            displayName: "Event",
                            type: "enum",
                            enumItems: eventEnumItems
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
                            enumItems: project.actions.map(action => ({
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
                eventName: result.values.eventName,
                handlerType: result.values.handlerType,
                action: result.values.action
            };

            const eventHandler = createObject<EventHandler>(
                project._store,
                properties,
                EventHandler
            );

            return eventHandler;
        },

        check: (eventHandler: EventHandler, messages: IMessage[]) => {
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
        }
    };
}

export class MQTTEventActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_MQTT_EVENT,
        properties: [
            makeExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:MQTTConnection"
            ),
            {
                name: "eventHandlers",
                type: PropertyType.Array,
                typeClass: EventHandler,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],
        icon: MQTT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "MQTT"
    });

    connection: string;
    eventHandlers: EventHandler[];

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable,
            eventHandlers: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...this.eventHandlers
                .filter(eventHandler => eventHandler.handlerType == "flow")
                .map(eventHandler => ({
                    name: eventHandler.eventName,
                    type: MQTT_EVENTS.find(
                        event => event.id == eventHandler.eventName
                    )!.paramExpressionType as ValueType,
                    isOptionalOutput: false,
                    isSequenceOutput: false
                })),
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.connection && (
                <div className="body">
                    <pre>{this.connection}</pre>
                </div>
            )
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        for (const eventHandler of MQTT_EVENTS) {
            dataBuffer.writeInt16(
                assets.getComponentOutputIndex(this, eventHandler.id)
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MQTTSubscribeActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_MQTT_SUBSCRIBE,
        properties: [
            makeExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:MQTTConnection"
            ),
            makeExpressionProperty(
                {
                    name: "topic",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: MQTT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "MQTT"
    });

    connection: string;
    topic: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable,
            topic: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.connection &&
            this.topic && (
                <div className="body">
                    <pre>
                        {this.connection}: {this.topic}
                    </pre>
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MQTTUnsubscribeActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_MQTT_UNSUBSCRIBE,
        properties: [
            makeExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:MQTTConnection"
            ),
            makeExpressionProperty(
                {
                    name: "topic",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: MQTT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "MQTT"
    });

    connection: string;
    topic: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable,
            topic: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.connection &&
            this.topic && (
                <div className="body">
                    <pre>
                        {this.connection}: {this.topic}
                    </pre>
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MQTTPublishActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_MQTT_PUBLISH,
        properties: [
            makeExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:MQTTConnection"
            ),
            makeExpressionProperty(
                {
                    name: "topic",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "payload",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: MQTT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "MQTT"
    });

    connection: string;
    topic: string;
    payload: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable,
            topic: observable,
            payload: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.connection &&
            this.topic &&
            this.payload && (
                <div className="body">
                    <pre>
                        {this.connection}: {this.topic}, {this.payload}
                    </pre>
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const mqttConnections = new Map<number, MQTTConnection>();
let nextMQTTConnectionId = 1;

registerObjectVariableType("MQTTConnection", {
    editConstructorParams: async (
        variable: IVariable,
        constructorParams?: MQTTConnectionConstructorParams
    ): Promise<MQTTConnectionConstructorParams | undefined> => {
        return await showConnectDialog(variable, constructorParams);
    },

    createValue: (
        constructorParams: MQTTConnectionConstructorParams,
        runtime: boolean
    ) => {
        if (constructorParams.id != undefined) {
            const existingConnection = mqttConnections.get(
                constructorParams.id
            );
            if (existingConnection) {
                return existingConnection;
            }
        }
        const id = nextMQTTConnectionId++;
        const mqttConnection = new MQTTConnection(id, constructorParams);
        mqttConnections.set(id, mqttConnection);
        if (runtime) {
            mqttConnection.connect();
        }
        return mqttConnection;
    },
    destroyValue: (
        objectVariable: IObjectVariableValue & { id: number },
        newValue?: IObjectVariableValue & { id: number }
    ) => {
        if (newValue && newValue.id == objectVariable.id) {
            return;
        }
        const mqttConnection = mqttConnections.get(objectVariable.id);
        if (mqttConnection) {
            mqttConnection.disconnect();
            mqttConnections.set(mqttConnection.id, mqttConnection);
        }
    },
    getValue: (variableValue: any): IObjectVariableValue | null => {
        return mqttConnections.get(variableValue.id) ?? null;
    },
    valueFieldDescriptions: [
        {
            name: "protocol",
            valueType: "string",
            getFieldValue: (value: MQTTConnection): string => {
                return value.protocol;
            }
        },
        {
            name: "host",
            valueType: "string",
            getFieldValue: (value: MQTTConnection): string => {
                return value.host;
            }
        },
        {
            name: "port",
            valueType: "integer",
            getFieldValue: (value: MQTTConnection): number => {
                return value.port;
            }
        },
        {
            name: "userName",
            valueType: "string",
            getFieldValue: (value: MQTTConnection): string => {
                return value.userName;
            }
        },
        {
            name: "password",
            valueType: "string",
            getFieldValue: (value: MQTTConnection): string => {
                return value.password;
            }
        },
        {
            name: "isConnected",
            valueType: "boolean",
            getFieldValue: (value: MQTTConnection): boolean => {
                return value.isConnected;
            }
        },
        {
            name: "id",
            valueType: "integer",
            getFieldValue: (value: MQTTConnection): number => {
                return value.id;
            }
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

async function showConnectDialog(
    variable: IVariable,
    values: MQTTConnectionConstructorParams | undefined
) {
    try {
        const result = await showGenericDialog({
            dialogDefinition: {
                title: variable.description || variable.fullName,
                size: "medium",
                fields: [
                    {
                        name: "protocol",
                        type: "enum",
                        enumItems: [
                            {
                                id: "mqtt",
                                label: "mqtt"
                            },
                            {
                                id: "mqtts",
                                label: "mqtts"
                            },
                            {
                                id: "ws",
                                label: "ws"
                            },
                            {
                                id: "wss",
                                label: "wss"
                            },
                            {
                                id: "tcp",
                                label: "tcp"
                            },
                            {
                                id: "ssl",
                                label: "ssl"
                            },
                            {
                                id: "wx",
                                label: "wx"
                            },
                            {
                                id: "wxs",
                                label: "wxs"
                            }
                        ],
                        validators: [validators.required]
                    },
                    {
                        name: "host",
                        type: "string",
                        validators: [validators.required]
                    },
                    {
                        name: "port",
                        type: "number",
                        validators: [validators.required]
                    },
                    {
                        name: "userName",
                        type: "string",
                        validators: []
                    },
                    {
                        name: "password",
                        type: "password",
                        validators: []
                    }
                ],
                error: undefined
            },
            values: values || {
                protocol: "mqtt",
                host: "",
                port: 1883,
                userName: "",
                password: ""
            },
            okButtonText: "Connect",
            onOk: async (result: GenericDialogResult) => {
                return new Promise<boolean>(async resolve => {
                    const mqttConnection = new MQTTConnection(0, result.values);
                    result.onProgress("info", "Connecting...");
                    try {
                        await mqttConnection.connect();
                        mqttConnection.disconnect();
                        resolve(true);
                    } catch (err) {
                        result.onProgress("error", err);
                        resolve(false);
                    }
                });
            }
        });

        return result.values;
    } catch (err) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

interface MQTTConnectionConstructorParams {
    id?: number;
    protocol: string;
    host: string;
    port: number;
    userName: string;
    password: string;
}

class MQTTConnection {
    constructor(
        public id: number,
        public constructorParams: MQTTConnectionConstructorParams,
        public wasmModuleId?: number
    ) {
        //console.log("new MQTTConnection", id);
        makeObservable(this, {
            error: observable,
            isConnected: observable,
            status: computed
        });
    }

    client: mqtt.MqttClient | undefined;
    isConnected: boolean = false;
    error: string | undefined = undefined;

    get protocol() {
        return this.constructorParams.protocol;
    }
    get host() {
        return this.constructorParams.host;
    }
    get port() {
        return this.constructorParams.port;
    }
    get userName() {
        return this.constructorParams.userName;
    }

    get password() {
        return this.constructorParams.password;
    }

    get status() {
        return {
            label: `${this.constructorParams.protocol}://${this.constructorParams.host}:${this.constructorParams.port}`,
            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsIAAA7CARUoSoAAAAItSURBVEhL1dZNSBVRGMbxmcjCiFz14aJVlKtcVFjUJghCIlq5aBHoQiwoyJaRCzdRUUhQUIuIyKiEdoLuolCQEgQzyk8KjTZhidEnwe3/nJl3ermc8m5c9MCPmTtn5rz3zMw596alUilZzqzIt8uWYgRpmp5ncxQ/4YelL/EJ9/AQ87CkOIMT4VOS/MIq9NDvuXBEBfIiL/VxCW/Qjmr4tMG+mMwU/boCW7ETB3EKdzEFu8h7jr3w0XUandrHYwViWYdDeAT/DeUbTsPnAL5jOlZAw9b9+1v2oB++iFyGzzFER9CHEfTiAhpRg/KcxGf4Ilfh0xIrMAN/kUyjE7Xw2Yc5+HM7UCRWQJ35C7x3aIVPPWbhzzuCkFgBPczj6MIQyh+q3MEaWBqgOWLteo03IVrAR5NrF26jvJCe1VpYmuHbr2PJAj778Qq+kx74ZeYBrO0r6mMF9CbcQAs264CLHvIgrBM5C8s2LMDabsUK6P7ZCR9wCf413YgXsHMWsR2Wa7C2iViBcXeCGcYWWHbjC6y9G5Yd0CzW8ehEixWQUWyA5QqsTROuDopW1gHoeFGgkt8Dve8Xs92Qm9DtUfQ2Hc52Q8ePs90/qfQHR+uLXltFE/JpthuiBc7yLN9qNCGVFqhCU7Yb8iTfKrpFWnWVt/iBaAF18q9o/bFM5FtFr/D6bDf5CBUoVmVf4D40fD3s12V0XPd9NZT30OSbzK2Eokk2Bk28kP/9X0WS/AaVCm1sgeHGuwAAAABJRU5ErkJggg==",
            color: this.error ? "red" : this.isConnected ? "green" : "gray",
            error: this.error
        };
    }

    async connect() {
        //console.log("connect called", this.id);

        const mqtt = await import("mqtt");

        this.client = mqtt.default.connect(undefined as any, {
            protocol: this.constructorParams.protocol as any,
            host: this.constructorParams.host,
            port: this.constructorParams.port,
            username: this.constructorParams.userName,
            password: this.constructorParams.password
        });

        this.client.on("connect", () => {
            //console.log("connect event", this.id);

            if (this.wasmModuleId != undefined) {
                sendMqttEvent(this.wasmModuleId, this.id, "connect", null);
            }

            runInAction(() => {
                this.isConnected = true;
            });
        });

        this.client.on("reconnect", () => {
            //console.log("reconnect event", this.id);

            if (this.wasmModuleId != undefined) {
                sendMqttEvent(this.wasmModuleId, this.id, "reconnect", null);
            }
        });

        this.client.on("close", () => {
            //console.log("close event", this.id);

            if (this.wasmModuleId != undefined) {
                sendMqttEvent(this.wasmModuleId, this.id, "close", null);
            }

            runInAction(() => {
                this.isConnected = false;
            });
        });

        this.client.on("disconnect", () => {
            //console.log("disconnect event", this.id);

            if (this.wasmModuleId != undefined) {
                sendMqttEvent(this.wasmModuleId, this.id, "disconnect", null);
            }
        });

        this.client.on("offline", () => {
            //console.log("offline event", this.id);

            if (this.wasmModuleId != undefined) {
                sendMqttEvent(this.wasmModuleId, this.id, "offline", null);
            }
        });

        this.client.on("error", err => {
            //console.log("error event", this.id);

            if (this.wasmModuleId != undefined) {
                sendMqttEvent(
                    this.wasmModuleId,
                    this.id,
                    "error",
                    err.toString()
                );
            }
        });

        this.client.on("message", (topic, message) => {
            if (this.wasmModuleId != undefined) {
                sendMqttEvent(this.wasmModuleId, this.id, "message", {
                    topic,
                    payload: message.toString()
                });
            }
        });

        this.client.on("end", () => {
            //console.log("end event", this.id);
            if (this.wasmModuleId != undefined) {
                sendMqttEvent(this.wasmModuleId, this.id, "end", null);
            }

            if (this.client) {
                this.client = undefined;
                runInAction(() => {
                    this.isConnected = false;
                });
            }
        });

        if (this.wasmModuleId == undefined) {
            return new Promise<void>((resolve, reject) => {
                const onConnect = () => {
                    if (this.client) {
                        console.log("onConnect", this.id);
                        runInAction(() => {
                            this.isConnected = true;
                        });
                        this.client!.off("connect", onConnect);
                        resolve();
                    } else {
                        reject(`client is undefined ${this.id}`);
                    }
                };

                const onError = (err: Error) => {
                    //console.log("onError", this.id);

                    this.client!.off("error", onError);
                    this.client = undefined;

                    runInAction(() => {
                        this.isConnected = false;
                        this.error = err.toString();
                    });
                    reject(err.toString());
                };

                this.client!.on("connect", onConnect);
                this.client!.on("error", onError);
            });
        }
    }

    subscribe(topic: string) {
        if (this.client) {
            this.client.subscribe(topic, { qos: 0, rap: true, rh: 1 });
        }
    }

    unsubscribe(topic: string) {
        if (this.client) {
            this.client.unsubscribe(topic);
        }
    }

    publish(topic: string, payload: string) {
        if (this.client) {
            this.client.publish(topic, payload, {
                qos: 0,
                retain: true,
                dup: false
            });
        }
    }

    disconnect() {
        if (this.client) {
            this.client.end();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const MQTT_ERROR_OK = 0;
const MQTT_ERROR_OTHER = 1;

function eez_mqtt_init(
    wasmModuleId: number,
    protocol: string,
    host: string,
    port: number,
    userName: string,
    password: string
) {
    // console.log(
    //     "eez_mqtt_init",
    //     wasmModuleId,
    //     protocol,
    //     host,
    //     port,
    //     userName,
    //     password
    // );

    const id = nextMQTTConnectionId++;

    const constructorParams: MQTTConnectionConstructorParams = {
        id,
        protocol,
        host,
        port,
        userName,
        password
    };

    const mqttConnection = new MQTTConnection(
        id,
        constructorParams,
        wasmModuleId
    );
    mqttConnections.set(id, mqttConnection);

    return id;
}

function eez_mqtt_deinit(wasmModuleId: number, handle: number) {
    //console.log("eez_mqtt_free", wasmModuleId, handle);

    const mqttConnection = mqttConnections.get(handle);
    if (!mqttConnection) {
        return MQTT_ERROR_OTHER;
    }

    if (mqttConnection.isConnected) {
        mqttConnection.disconnect();
    }

    mqttConnections.delete(handle);

    return MQTT_ERROR_OK;
}

function eez_mqtt_connect(wasmModuleId: number, handle: number) {
    //console.log("eez_mqtt_connect", wasmModuleId, handle);

    const mqttConnection = mqttConnections.get(handle);
    if (!mqttConnection) {
        return MQTT_ERROR_OTHER;
    }

    mqttConnection.connect();

    return MQTT_ERROR_OK;
}

function eez_mqtt_disconnect(wasmModuleId: number, handle: number) {
    //console.log("eez_mqtt_disconnect", wasmModuleId, handle);

    const mqttConnection = mqttConnections.get(handle);
    if (!mqttConnection) {
        return MQTT_ERROR_OTHER;
    }

    mqttConnection.disconnect();

    return MQTT_ERROR_OK;
}

function eez_mqtt_subscribe(
    wasmModuleId: number,
    handle: number,
    topic: string
) {
    //console.log("eez_mqtt_subscribe", wasmModuleId, handle, topic);

    const mqttConnection = mqttConnections.get(handle);
    if (!mqttConnection) {
        return MQTT_ERROR_OTHER;
    }

    mqttConnection.subscribe(topic);

    return MQTT_ERROR_OK;
}

function eez_mqtt_unsubscribe(
    wasmModuleId: number,
    handle: number,
    topic: string
) {
    //console.log("eez_mqtt_unsubscribe", wasmModuleId, handle, topic);

    const mqttConnection = mqttConnections.get(handle);
    if (!mqttConnection) {
        return MQTT_ERROR_OTHER;
    }

    mqttConnection.unsubscribe(topic);

    return MQTT_ERROR_OK;
}

function eez_mqtt_publish(
    wasmModuleId: number,
    handle: number,
    topic: string,
    payload: string
) {
    //console.log("eez_mqtt_publish", wasmModuleId, handle, topic, payload);

    const mqttConnection = mqttConnections.get(handle);
    if (!mqttConnection) {
        return MQTT_ERROR_OTHER;
    }

    mqttConnection.publish(topic, payload);

    return MQTT_ERROR_OK;
}

registerClass("MQTTInitActionComponent", MQTTInitActionComponent);
registerClass("MQTTEventActionComponent", MQTTEventActionComponent);
registerClass("MQTTConnectActionComponent", MQTTConnectActionComponent);
registerClass("MQTTDisconnectActionComponent", MQTTDisconnectActionComponent);
registerClass("MQTTSubscribeActionComponent", MQTTSubscribeActionComponent);
registerClass("MQTTUnsubscribeActionComponent", MQTTUnsubscribeActionComponent);
registerClass("MQTTPublishActionComponent", MQTTPublishActionComponent);

(global as any).eez_mqtt_init = eez_mqtt_init;
(global as any).eez_mqtt_deinit = eez_mqtt_deinit;
(global as any).eez_mqtt_connect = eez_mqtt_connect;
(global as any).eez_mqtt_disconnect = eez_mqtt_disconnect;
(global as any).eez_mqtt_subscribe = eez_mqtt_subscribe;
(global as any).eez_mqtt_unsubscribe = eez_mqtt_unsubscribe;
(global as any).eez_mqtt_publish = eez_mqtt_publish;
