import { makeObservable, observable, runInAction } from "mobx";
import * as net from "net";

import { registerActionComponents } from "project-editor/flow/component";
import { TCP_CONNECT_ICON } from "project-editor/ui-components/icons";

import type {
    IDashboardComponentContext,
    IObjectVariableValue,
    IVariable
} from "eez-studio-types";
import { registerObjectVariableType } from "project-editor/features/variable/value-type";
import {
    GenericDialogResult,
    showGenericDialog
} from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";

const componentHeaderColor = "#cca3ba";

registerActionComponents("TCP", [
    {
        name: "TCPConnect",
        icon: TCP_CONNECT_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "connection",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "assignable-expression",
                valueType: "object:TCPConnection"
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
        execute: async (context: IDashboardComponentContext) => {
            const ipAddress = context.evalProperty<string>("ipAddress");
            if (!ipAddress || typeof ipAddress != "string") {
                context.throwError(`invalid IP Address property`);
                return;
            }

            const port = context.evalProperty<number>("port");
            if (!port || typeof port != "number") {
                context.throwError(`invalid Port property`);
                return;
            }

            const constructorParams: TCPConnectionConstructorParams = {
                ipAddress,
                port
            };

            const id = nextTCPConnectionId++;
            let tcpConnection = new TCPConnection(id, constructorParams);
            tcpConnections.set(id, tcpConnection);

            context = context.startAsyncExecution();

            try {
                await tcpConnection.connect();

                context.assignProperty("connection", {
                    id: tcpConnection.id,
                    status: tcpConnection.status
                });

                context.propagateValueThroughSeqout();
            } catch (err) {
                context.throwError(`Failed to connect ${err.code}`);
            } finally {
                context.endAsyncExecution();
            }
        }
    },
    {
        name: "TCPDisconnect",
        icon: TCP_CONNECT_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "connection",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "expression",
                valueType: "object:TCPConnection"
            }
        ],
        defaults: {},
        execute: (context: IDashboardComponentContext) => {
            const tcpConnection = context.evalProperty("connection");
            if (!tcpConnection) {
                context.throwError(`invalid connection`);
                return;
            }

            console.log(tcpConnection);

            context = context.startAsyncExecution();

            (async (tcpConnectionId: number) => {
                const tcpConnection = tcpConnections.get(tcpConnectionId);

                if (tcpConnection) {
                    tcpConnection.disconnect();
                    context.propagateValueThroughSeqout();
                } else {
                    context.throwError("tcp connection not found");
                }

                context.endAsyncExecution();
            })(tcpConnection.id);
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

export const tcpConnections = new Map<number, TCPConnection>();
let nextTCPConnectionId = 0;

registerObjectVariableType("TCPConnection", {
    editConstructorParams: async (
        variable: IVariable,
        constructorParams?: TCPConnectionConstructorParams
    ): Promise<TCPConnectionConstructorParams | undefined> => {
        return await showConnectDialog(variable, constructorParams);
    },

    createValue: (constructorParams: TCPConnectionConstructorParams) => {
        const id = nextTCPConnectionId++;
        const tcpConnection = new TCPConnection(id, constructorParams);
        tcpConnections.set(id, tcpConnection);
        return tcpConnection;
    },
    destroyValue: (objectVariable: IObjectVariableValue & { id: number }) => {
        const tcpConnection = tcpConnections.get(objectVariable.id);
        if (tcpConnection) {
            tcpConnection.disconnect();
            tcpConnections.delete(tcpConnection.id);
        }
    },
    getValue: (variableValue: any): IObjectVariableValue | null => {
        return tcpConnections.get(variableValue.id) ?? null;
    },
    valueFieldDescriptions: [
        {
            name: "ipAddress",
            valueType: "string",
            getFieldValue: (value: TCPConnection): string => {
                return value.constructorParams.ipAddress;
            }
        },
        {
            name: "port",
            valueType: "integer",
            getFieldValue: (value: TCPConnection): number => {
                return value.constructorParams.port;
            }
        },
        {
            name: "isConnected",
            valueType: "boolean",
            getFieldValue: (value: TCPConnection): boolean => {
                return value.isConnected;
            }
        },
        {
            name: "id",
            valueType: "integer",
            getFieldValue: (value: TCPConnection): number => {
                return value.id;
            }
        }
    ]
});

interface TCPConnectionConstructorParams {
    ipAddress: string;
    port: number;
}

////////////////////////////////////////////////////////////////////////////////

export class TCPConnection {
    constructor(
        public id: number,
        public constructorParams: TCPConnectionConstructorParams
    ) {
        makeObservable(this, {
            isConnected: observable
        });
    }

    socket: net.Socket | undefined;

    error: string | undefined = undefined;
    isConnected: boolean = false;

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
}

////////////////////////////////////////////////////////////////////////////////

async function showConnectDialog(
    variable: IVariable,
    values: TCPConnectionConstructorParams | undefined
) {
    try {
        const result = await showGenericDialog({
            dialogDefinition: {
                title: variable.description || variable.fullName,
                size: "medium",
                fields: [
                    {
                        name: "ipAddress",
                        displayName: "IP Address",
                        type: "string"
                    },
                    {
                        name: "port",
                        type: "number",
                        validators: [validators.integer]
                    }
                ],
                error: undefined
            },
            values: values || {},
            okButtonText: "Connect",
            onOk: async (result: GenericDialogResult) => {
                return new Promise<boolean>(async resolve => {
                    const tcpConnection = new TCPConnection(0, result.values);
                    result.onProgress("info", "Connecting...");
                    try {
                        await tcpConnection.connect();
                        tcpConnection.disconnect();
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
