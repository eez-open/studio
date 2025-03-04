import React from "react";
import { makeObservable, observable, runInAction } from "mobx";
import * as net from "net";

import * as notification from "eez-studio-ui/notification";

import {
    ActionComponent,
    makeExpressionProperty,
    registerActionComponents
} from "project-editor/flow/component";
import {
    TCP_CONNECT_ICON,
    TCP_LISTEN_ICON,
    TCP_EVENT_ICON,
    TCP_WRITE_ICON,
    TCP_DISCONNECT_ICON,
    LeftArrow
} from "project-editor/ui-components/icons";

import type {
    IActionComponent,
    IDashboardComponentContext,
    IObjectVariableValue,
    IVariable
} from "eez-studio-types";
import { registerObjectVariableType } from "project-editor/features/variable/value-type";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import {
    ClassInfo,
    EezObject,
    IEezObject,
    IMessage,
    makeDerivedClassInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import {
    createObject,
    getAncestorOfType,
    propertyNotSetMessage
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { Assets, DataBuffer } from "project-editor/build/assets";
import type { IComponentExecutionState } from "project-editor/flow/runtime/component-execution-states";

const componentHeaderColor = "#cca3ba";

registerActionComponents("Network", [
    {
        name: "TCPConnect",
        icon: TCP_CONNECT_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "socket",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "socket",
                type: "assignable-expression",
                valueType: "object:TCPSocket"
            },

            {
                name: "ipAddress",
                displayName: "IP Address",
                type: "expression",
                valueType: "object:string"
            },

            {
                name: "port",
                type: "expression",
                valueType: "object:number"
            }
        ],
        defaults: {},
        migrateProperties: (component: IActionComponent) => {
            if (component.connection) {
                component.socket = component.connection;
                delete component.connection;
            }
        },
        execute: async (context: IDashboardComponentContext) => {
            const ipAddress = context.evalProperty<string>("ipAddress");
            if (!ipAddress || typeof ipAddress != "string") {
                context.throwError(`invalid IP Address property`);
                return;
            }

            const port = context.evalProperty<number>("port");
            if (port == undefined || typeof port != "number") {
                context.throwError(`invalid Port property`);
                return;
            }

            const constructorParams: TCPSocketConstructorParams = {
                ipAddress,
                port
            };

            const id = nextTCPSocketId++;
            let tcpSocket = new TCPSocket("client", id, constructorParams);
            tcpSockets.set(id, tcpSocket);

            context.assignProperty(
                "socket",
                {
                    id: tcpSocket.id,
                    status: tcpSocket.status
                },
                undefined
            );

            context.propagateValueThroughSeqout();

            tcpSocket.connect();
        }
    },
    {
        name: "TCPListen",
        icon: TCP_LISTEN_ICON as any,
        componentHeaderColor,
        bodyPropertyCallback: (port, ipAddress) =>
            ipAddress ? `${ipAddress}:${port}` : `${port}`,
        inputs: [
            {
                name: "end",
                type: "any",
                isSequenceInput: true,
                isOptionalInput: true
            }
        ],
        outputs: [
            {
                name: "connection",
                type: "object:TCPSocket",
                isSequenceOutput: false,
                isOptionalOutput: false
            },
            {
                name: "close",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ],
        properties: [
            {
                name: "port",
                type: "expression",
                valueType: "object:number"
            },
            {
                name: "ipAddress",
                displayName: "IP Address",
                type: "expression",
                valueType: "object:string",
                formText: "This property is optional",
                optional: () => true
            },
            {
                name: "maxConnections",
                displayName: "Max. Connections",
                type: "expression",
                valueType: "object:number"
            }
        ],
        defaults: {},
        execute: async (context: IDashboardComponentContext) => {
            let executionState =
                context.getComponentExecutionState<TCPListenExecutionState>();

            if (context.getInputValue("@seqin") !== undefined) {
                if (executionState) {
                    // ignore
                    return;
                }

                const port = context.evalProperty<number>("port");
                if (port == undefined || typeof port != "number") {
                    context.throwError(`invalid Port property`);
                    return;
                }

                const ipAddress = context.evalProperty<string>("ipAddress");
                if (ipAddress != undefined && typeof ipAddress != "string") {
                    context.throwError(`invalid IP Address property`);
                    return;
                }

                const maxConnections = context.evalProperty<number>("port");
                if (
                    maxConnections == undefined ||
                    typeof maxConnections != "number"
                ) {
                    context.throwError(`invalid Max. connections property`);
                    return;
                }

                executionState = new TCPListenExecutionState(
                    port,
                    ipAddress,
                    maxConnections
                );

                context.setComponentExecutionState(executionState);

                executionState.start(context);

                context.propagateValueThroughSeqout();
            } else {
                if (!executionState) {
                    context.throwError("Never started");
                    return;
                }

                executionState.end(context);
            }
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

const TCP_SOCKET_EVENTS = [
    { id: "ready", label: "Ready", paramExpressionType: "null" },
    { id: "data", label: "Data", paramExpressionType: "string" },
    { id: "close", label: "Close", paramExpressionType: "null" },
    { id: "end", label: "End", paramExpressionType: "null" },
    { id: "error", label: "Error", paramExpressionType: "string" },
    { id: "timeout", label: "Timeout", paramExpressionType: "null" }
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
                        getAncestorOfType<TCPEventActionComponent>(
                            eventHandler,
                            TCPEventActionComponent.classInfo
                        )!;

                    const eventEnumItems = TCP_SOCKET_EVENTS.filter(
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
                const component = getAncestorOfType<TCPEventActionComponent>(
                    eventHandler,
                    TCPEventActionComponent.classInfo
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
                const component = getAncestorOfType<TCPEventActionComponent>(
                    eventHandler,
                    TCPEventActionComponent.classInfo
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
            const component = getAncestorOfType<TCPEventActionComponent>(
                eventHandler,
                TCPEventActionComponent.classInfo
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

            const eventEnumItems = TCP_SOCKET_EVENTS.filter(
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

export class TCPEventActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "socket",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:TCPSocket"
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
        icon: TCP_EVENT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "Network",

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.connection) {
                jsObject.socket = jsObject.connection;
                delete jsObject.connection;
            }
        },

        execute: (context: IDashboardComponentContext) => {
            const tcpSocketObject = context.evalProperty("socket");
            if (!tcpSocketObject) {
                context.throwError(`invalid Socket property`);
                return;
            }

            const tcpSocket = tcpSockets.get(tcpSocketObject.id);

            if (tcpSocket) {
                if (tcpSocket.socket) {
                    context.startAsyncExecution();
                    for (let i = 0; i < TCP_SOCKET_EVENTS.length; i++) {
                        const outputIndex = context.getUint32Param(i * 4);
                        if (outputIndex != -1) {
                            tcpSocket.socket.on(
                                TCP_SOCKET_EVENTS[i].id,
                                value => {
                                    if (TCP_SOCKET_EVENTS[i].id == "data") {
                                        value = value.toString();
                                    } else if (
                                        TCP_SOCKET_EVENTS[i].id == "error"
                                    ) {
                                        value = value.toString();
                                    }
                                    context.propagateValue(
                                        TCP_SOCKET_EVENTS[i].id,
                                        value
                                    );

                                    if (!tcpSocket.socket) {
                                        context.endAsyncExecution();
                                    }
                                }
                            );
                        }
                    }
                } else {
                    context.throwError("tcp socket is not connected");
                }

                context.propagateValueThroughSeqout();
            } else {
                context.throwError("tcp socket not found");
            }
        }
    });

    scoket: string;
    eventHandlers: EventHandler[];

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            scoket: observable,
            eventHandlers: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as any,
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
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...this.eventHandlers
                .filter(eventHandler => eventHandler.handlerType == "flow")
                .map(eventHandler => ({
                    name: eventHandler.eventName,
                    type: TCP_SOCKET_EVENTS.find(
                        event => event.id == eventHandler.eventName
                    )!.paramExpressionType as any,
                    isOptionalOutput: false,
                    isSequenceOutput: false
                })),
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            this.scoket && (
                <div className="body">
                    <pre>{this.scoket}</pre>
                </div>
            )
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        for (const eventHandler of TCP_SOCKET_EVENTS) {
            dataBuffer.writeInt32(
                assets.getComponentOutputIndex(this, eventHandler.id)
            );
        }
    }
}

registerClass("TCPEventActionComponent", TCPEventActionComponent);

////////////////////////////////////////////////////////////////////////////////

registerActionComponents("Network", [
    {
        name: "TCPWrite",
        icon: TCP_WRITE_ICON as any,
        componentHeaderColor,
        bodyPropertyCallback: (socket, data) => (
            <pre>
                {socket} <LeftArrow /> {data}
            </pre>
        ),
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "socket",
                type: "expression",
                valueType: "object:TCPSocket"
            },
            {
                name: "data",
                type: "expression",
                valueType: "object:string"
            }
        ],
        defaults: {},
        migrateProperties: (component: IActionComponent) => {
            if (component.connection) {
                component.socket = component.connection;
                delete component.connection;
            }
        },
        execute: (context: IDashboardComponentContext) => {
            const tcpSocketObject = context.evalProperty("socket");
            if (!tcpSocketObject) {
                context.throwError(`invalid Socket property`);
                return;
            }

            const data = context.evalProperty("data");
            if (data == undefined || typeof data != "string") {
                context.throwError(`invalid Data property`);
                return;
            }

            const tcpSocket = tcpSockets.get(tcpSocketObject.id);

            if (tcpSocket) {
                tcpSocket.write(data);
                context.propagateValueThroughSeqout();
            } else {
                context.throwError("TCP socket not found");
            }
        }
    },
    {
        name: "TCPDisconnect",
        icon: TCP_DISCONNECT_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "socket",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "socket",
                type: "expression",
                valueType: "object:TCPSocket"
            }
        ],
        defaults: {},
        migrateProperties: (component: IActionComponent) => {
            if (component.connection) {
                component.socket = component.connection;
                delete component.connection;
            }
        },
        execute: (context: IDashboardComponentContext) => {
            const tcpSocket = context.evalProperty("socket");
            if (!tcpSocket) {
                context.throwError(`invalid Socket property`);
                return;
            }

            context = context.startAsyncExecution();

            (async (tcpSocketId: number) => {
                const tcpSocket = tcpSockets.get(tcpSocketId);

                if (tcpSocket) {
                    tcpSocket.disconnect();
                    context.propagateValueThroughSeqout();
                } else {
                    context.throwError("TCP socket not found");
                }

                context.endAsyncExecution();
            })(tcpSocket.id);
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

class TCPListenExecutionState implements IComponentExecutionState {
    constructor(
        public port: number,
        public ipAddress: string | undefined,
        public maxConnections: number
    ) {}

    server: net.Server | undefined;

    start(context: IDashboardComponentContext) {
        context = context.startAsyncExecution();

        var server = net.createServer();
        this.server = server;

        server.on("close", () => {
            this.server = undefined;

            context.setComponentExecutionState(undefined);
            context.propagateValue("close", null);
            context.endAsyncExecution();
        });

        server.on("connection", socket => {
            const constructorParams: TCPSocketConstructorParams = {
                ipAddress: (socket.address() as net.AddressInfo).address ?? "",
                port: (socket.address() as net.AddressInfo).port ?? 0
            };

            const id = nextTCPSocketId++;
            let tcpSocket = new TCPSocket("server", id, constructorParams);
            tcpSockets.set(id, tcpSocket);

            tcpSocket.setSocket(socket);

            context.propagateValue("connection", {
                id: tcpSocket.id,
                status: tcpSocket.status
            });
        });

        server.on("error", err => {
            let executionState =
                context.getComponentExecutionState<TCPListenExecutionState>();
            if (executionState) {
                context.throwError(err.toString());
                context.setComponentExecutionState(undefined);
                context.endAsyncExecution();
            }
        });

        server.on("listening", function () {});

        server.maxConnections = this.maxConnections;

        server.listen(this.port);
    }

    end(context: IDashboardComponentContext) {
        if (this.server) {
            this.server.close();
        }
    }

    onDestroy() {
        if (this.server) {
            this.server.close();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export const tcpSockets = new Map<number, TCPSocket>();
let nextTCPSocketId = 0;

registerObjectVariableType("TCPSocket", {
    editConstructorParams: async (
        variable: IVariable,
        constructorParams?: TCPSocketConstructorParams
    ): Promise<TCPSocketConstructorParams | undefined> => {
        return undefined;
    },

    createValue: (constructorParams: TCPSocketConstructorParams) => {
        return {
            constructorParams,
            status: {}
        };
    },
    destroyValue: (objectVariable: IObjectVariableValue & { id: number }) => {
        const tcpSocket = tcpSockets.get(objectVariable.id);
        if (tcpSocket) {
            tcpSocket.disconnect();
            tcpSockets.delete(tcpSocket.id);
        }
    },
    getValue: (variableValue: any): IObjectVariableValue | null => {
        return variableValue ? tcpSockets.get(variableValue.id) ?? null : null;
    },
    valueFieldDescriptions: [
        {
            name: "ipAddress",
            valueType: "string",
            getFieldValue: (value: TCPSocket): string => {
                return value.constructorParams.ipAddress;
            }
        },
        {
            name: "port",
            valueType: "integer",
            getFieldValue: (value: TCPSocket): number => {
                return value.constructorParams.port;
            }
        },
        {
            name: "isConnected",
            valueType: "boolean",
            getFieldValue: (value: TCPSocket): boolean => {
                return value.isConnected;
            }
        },
        {
            name: "id",
            valueType: "integer",
            getFieldValue: (value: TCPSocket): number => {
                return value.id;
            }
        }
    ]
});

interface TCPSocketConstructorParams {
    ipAddress: string;
    port: number;
}

////////////////////////////////////////////////////////////////////////////////

export class TCPSocket {
    constructor(
        public type: "server" | "client",
        public id: number,
        public constructorParams: TCPSocketConstructorParams
    ) {
        makeObservable(this, {
            isConnected: observable
        });
    }

    socket: net.Socket | undefined;

    error: string | undefined = undefined;
    isConnected: boolean = false;

    get ipAddress() {
        return this.constructorParams.ipAddress;
    }

    get port() {
        return this.constructorParams.port;
    }

    get status() {
        return {
            label: `IP address: ${this.constructorParams.ipAddress}, Port: ${this.constructorParams.port}`,
            image: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68.792 34.396"><g transform="translate(-21.422 -163.072)" fill="none"><circle stroke="black" cx="43.765" cy="180.27" r="7.955"/><circle stroke="black" cx="67.686" cy="180.27" r="7.955"/></g><path stroke="black" transform="translate(-21.422 -163.072)" d="M31.674 171.406v17.728M55.726 171.406v17.728M79.96 171.406v17.728"/></svg>`,
            color: this.error ? "red" : this.isConnected ? "green" : "gray",
            error: this.error
        };
    }

    async connect() {
        return new Promise<void>((resolve, reject) => {
            this.socket = new net.Socket();

            let promiseCompleted = false;

            this.socket.on("connect", () => {
                runInAction(() => {
                    this.isConnected = true;
                });
                if (!promiseCompleted) {
                    promiseCompleted = true;
                    resolve();
                }
            });

            this.socket.on("ready", () => {});

            this.socket.on("error", err => {
                this.destroy();
                if (!promiseCompleted) {
                    promiseCompleted = true;
                    reject(err);
                }
            });

            this.socket.on("close", () => {
                this.destroy();
            });

            this.socket.on("end", () => {
                this.destroy();
            });

            this.socket.on("timeout", () => {
                this.destroy();
            });

            this.socket.connect({
                host: this.constructorParams.ipAddress,
                port: this.constructorParams.port
            });
        });
    }

    setSocket(socket: net.Socket) {
        this.isConnected = true;
        this.socket = socket;

        socket.on("error", err => {
            this.destroy();
        });

        socket.on("close", () => {
            this.destroy();
        });

        socket.on("end", () => {
            this.destroy();
        });

        socket.on("timeout", () => {
            this.destroy();
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.end();
            this.destroy();
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.destroy();
            this.socket.unref();
            this.socket.removeAllListeners();
            this.socket = undefined;
        }

        runInAction(() => {
            this.isConnected = false;
        });
    }

    read() {}

    write(data: string) {
        if (this.socket) {
            this.socket.write(data);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////
