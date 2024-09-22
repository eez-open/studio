import React from "react";
import { makeObservable, observable } from "mobx";
import type { Socket, SocketType } from "dgram";

import {
    ActionComponent,
    makeExpressionProperty
} from "project-editor/flow/component";
import { UDP_IN_ICON, UDP_OUT_ICON } from "project-editor/ui-components/icons";

import type {
    IDashboardComponentContext,
    IWasmFlowRuntime
} from "eez-studio-types";
import {
    makeDerivedClassInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { Assets, DataBuffer } from "project-editor/build/assets";
import { registerSystemStructure } from "project-editor/features/variable/value-type";
import { onWasmFlowRuntimeTerminate } from "project-editor/flow/runtime/wasm-worker";

////////////////////////////////////////////////////////////////////////////////

const componentHeaderColor = "#cca3ba";

////////////////////////////////////////////////////////////////////////////////

const MODE_UDP = 0;
const MODE_MULTICAST = 1;
const MODE_BROADCAST = 2;

const IPV4 = 0;
const IPV6 = 1;

const OUTPORT_TYPE_FIXED = 0;
const OUTPORT_TYPE_RANDOM = 1;

////////////////////////////////////////////////////////////////////////////////

const UDP_MESSAGE_STRUCT_NAME = "$UDPMessage";

registerSystemStructure({
    name: UDP_MESSAGE_STRUCT_NAME,
    fields: [
        {
            name: "payload",
            type: "blob"
        },
        {
            name: "address",
            type: "string"
        },
        {
            name: "port",
            type: "integer"
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

interface IPortInUse {
    wasmModuleId: number;
    port: number;
    server: Socket;
    group: string | undefined;
}

const udpInputPortsInUse = new Map<number, IPortInUse>();

onWasmFlowRuntimeTerminate((wasmFlowRuntime: IWasmFlowRuntime) => {
    for (const port of udpInputPortsInUse.keys()) {
        const { server, group } = udpInputPortsInUse.get(port)!;
        try {
            if (group) {
                server.dropMembership(group);
            }
            server.close();
        } catch (err) {
            console.error(
                `Free UDP input port in use ${port}: ${err.toString()}`
            );
        }
        udpInputPortsInUse.delete(port);
    }
});

////////////////////////////////////////////////////////////////////////////////

export class UDPInActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: () => "UDP In",
        componentPaletteLabel: "UDP In",

        properties: [
            {
                name: "multicast",
                displayName: "Listen for",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "udp", label: "UDP messages" },
                    { id: "multicast", label: "Multicast messages" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "group",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (object: UDPInActionComponent) =>
                        object.multicast !== "multicast"
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "iface",
                    displayName: "Local interface",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    isOptional: true,
                    disabled: (object: UDPInActionComponent) =>
                        object.multicast !== "multicast"
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "port",
                    displayName: "On port",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            {
                name: "ipv",
                displayName: "Using",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "udp4", label: "IPv4" },
                    { id: "udp6", label: "IPv6" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            }
        ],
        icon: UDP_IN_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "Network",

        defaultValue: {
            multicast: "udp",
            group: "",
            iface: "",
            port: "",
            ipv: "udp4"
        },

        execute: (context: IDashboardComponentContext) => {
            var os = require("os") as typeof import("os");
            var dgram = require("dgram") as typeof import("dgram");

            const multicast = context.getUint8Param(0);

            let group: string | undefined;
            let iface: string | undefined;
            if (multicast == MODE_MULTICAST) {
                group = context.evalProperty<string>("group");
                if (group == undefined || typeof group != "string") {
                    context.throwError(`invalid Group property`);
                    return;
                }

                iface = context.evalProperty<string>("iface");
                if (iface != undefined && typeof iface != "string") {
                    context.throwError(`invalid Local interface property`);
                    return;
                }
            }

            const port = context.evalProperty<number>("port");
            if (port == undefined || typeof port != "number") {
                context.throwError(`invalid Port property`);
                return;
            }

            const ipv: SocketType =
                context.getUint8Param(1) == IPV6 ? "udp6" : "udp4";

            if (iface && iface.indexOf(".") === -1) {
                const networkInterface = os.networkInterfaces()[iface];

                if (networkInterface) {
                    try {
                        if (networkInterface[0].hasOwnProperty("scopeid")) {
                            if (ipv === "udp4") {
                                iface = networkInterface[1].address;
                            } else {
                                iface = networkInterface[0].address;
                            }
                        } else {
                            if (ipv === "udp4") {
                                iface = networkInterface[0].address;
                            } else {
                                iface = networkInterface[1].address;
                            }
                        }
                    } catch (e) {
                        iface = undefined;
                    }
                } else {
                    iface = undefined;
                }
            }

            var opts = { type: ipv, reuseAddr: true };
            var server: Socket;

            const portInUse = udpInputPortsInUse.get(port);

            context.startAsyncExecution();

            if (!portInUse) {
                server = dgram.createSocket(opts);

                server.bind(port, function () {
                    if (multicast == MODE_MULTICAST && group) {
                        server.setBroadcast(true);
                        server.setMulticastLoopback(false);
                        try {
                            server.setMulticastTTL(128);
                            server.addMembership(group, iface);
                        } catch (err) {
                            context.throwError(err.toString());
                        }
                    }
                });

                udpInputPortsInUse.set(port, {
                    wasmModuleId: context.WasmFlowRuntime.wasmModuleId,
                    port,
                    server,
                    group
                });
            } else {
                server = portInUse.server; // re-use existing
            }

            server.on("error", function (err) {
                context.throwError(err.toString());
                context.endAsyncExecution();
            });

            server.on("message", function (message, remote) {
                context.propagateValue("message", {
                    payload: message,
                    address: remote.address,
                    port: remote.port
                });
            });

            server.on("listening", function () {
                context.propagateValueThroughSeqout();
            });
        }
    });

    multicast: string;
    group: string;
    iface: string;
    port: string;
    ipv: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            multicast: observable,
            group: observable,
            iface: observable,
            port: observable,
            ipv: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as const,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as const,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "message",
                type: `struct:${UDP_MESSAGE_STRUCT_NAME}` as const,
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {`Listen for ${
                        this.multicast == "udp"
                            ? "UDP messages"
                            : `Multicast messages\nIn group: ${this.group}${
                                  this.iface
                                      ? `\nOn local interface: ${this.iface}`
                                      : ""
                              }`
                    }\nOn port: ${this.port}\nUsing: ${
                        this.ipv == "udp4" ? "IPv4" : "IPv6"
                    }`}
                </pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeUint8(
            this.multicast == "multicast" ? MODE_MULTICAST : MODE_UDP
        );
        dataBuffer.writeUint8(this.ipv == "udp6" ? IPV6 : IPV4);
    }
}

registerClass("UDPInActionComponent", UDPInActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class UDPOutActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: () => "UDP Out",
        componentPaletteLabel: "UDP Out",

        properties: [
            {
                name: "multicast",
                displayName: "Send a",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "udp", label: "UDP message" },
                    { id: "broadcast", label: "Broadcast message" },
                    { id: "multicast", label: "Multicast message" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "port",
                    displayName: "To port",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "address",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "group",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (object: UDPOutActionComponent) =>
                        object.multicast !== "multicast"
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "iface",
                    displayName: "Local interface",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    isOptional: true,
                    disabled: (object: UDPOutActionComponent) =>
                        object.multicast !== "multicast"
                },
                "string"
            ),
            {
                name: "ipv",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "udp4", label: "IPv4" },
                    { id: "udp6", label: "IPv6" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "outportType",
                displayName: "Bind to",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "random", label: "Random local port" },
                    { id: "fixed", label: "Fixed local port" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "outport",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    enumDisallowUndefined: true,
                    disabled: (object: UDPOutActionComponent) =>
                        object.outportType !== "fixed"
                },
                "integer"
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
        icon: UDP_OUT_ICON,
        componentHeaderColor,
        componentPaletteGroupName: "Network",

        defaultValue: {
            multicast: "udp",
            address: "",
            group: "",
            iface: "",
            port: "",
            ipv: "udp4",
            outportType: "random",
            outport: ""
        },

        execute: (context: IDashboardComponentContext) => {
            var os = require("os") as typeof import("os");
            var dgram = require("dgram") as typeof import("dgram");

            const multicast = context.getUint8Param(0);

            let address: string | undefined;

            let group: string | undefined;
            let iface: string | undefined;

            if (multicast != MODE_MULTICAST) {
                address = context.evalProperty<string>("address");
                if (address == undefined || typeof address != "string") {
                    context.throwError(`invalid Address property`);
                }
            } else {
                group = context.evalProperty<string>("group");
                if (group == undefined || typeof group != "string") {
                    context.throwError(`invalid Group property`);
                }

                iface = context.evalProperty<string>("iface");
                if (iface != undefined && typeof iface != "string") {
                    context.throwError(`invalid Local interface property`);
                    return;
                }
            }

            const port = context.evalProperty<number>("port");
            if (port == undefined || typeof port != "number") {
                context.throwError(`invalid Port property`);
                return;
            }

            const ipv: SocketType =
                context.getUint8Param(1) == IPV6 ? "udp6" : "udp4";

            const outportType = context.getUint8Param(2);

            let outport: number | undefined;
            if (outportType == OUTPORT_TYPE_FIXED) {
                outport = context.evalProperty<number>("outport");
                if (outport == undefined || typeof outport != "number") {
                    context.throwError(`invalid Outport property`);
                    return;
                }
            }

            const payload = context.evalProperty<string>("payload");
            if (payload == undefined || typeof payload != "string") {
                context.throwError(`invalid Payload property`);
                return;
            }

            if (iface && iface.indexOf(".") === -1) {
                const networkInterface = os.networkInterfaces()[iface];

                if (networkInterface) {
                    try {
                        if (networkInterface[0].hasOwnProperty("scopeid")) {
                            if (ipv === "udp4") {
                                iface = networkInterface[1].address;
                            } else {
                                iface = networkInterface[0].address;
                            }
                        } else {
                            if (ipv === "udp4") {
                                iface = networkInterface[0].address;
                            } else {
                                iface = networkInterface[1].address;
                            }
                        }
                    } catch (e) {
                        iface = undefined;
                    }
                } else {
                    iface = undefined;
                }
            }

            var opts = { type: ipv, reuseAddr: true };

            var sock: Socket;

            var p = outport || port || 0;

            context.startAsyncExecution();

            if (p != 0 && udpInputPortsInUse.has(p)) {
                sock = udpInputPortsInUse.get(p)!.server;
                if (multicast != MODE_UDP) {
                    sock.setBroadcast(true);
                    sock.setMulticastLoopback(false);
                }
            } else {
                sock = dgram.createSocket(opts);
                if (multicast != MODE_UDP) {
                    sock.bind(outport, function () {
                        // have to bind before you can enable broadcast...
                        sock.setBroadcast(true); // turn on broadcast
                        sock.setMulticastLoopback(false); // turn off loopback
                        if (multicast == MODE_MULTICAST && group) {
                            try {
                                sock.setMulticastTTL(128);
                                sock.addMembership(group, iface); // Add to the multicast group
                            } catch (e) {
                                context.throwError(e.toString());
                                context.endAsyncExecution();
                            }
                        }
                    });
                } else if (
                    outport !== undefined &&
                    !udpInputPortsInUse.has(outport)
                ) {
                    sock.bind(outport);
                }

                sock.on("error", function (err) {
                    context.throwError(err.toString());
                    context.endAsyncExecution();
                });

                udpInputPortsInUse.set(p, {
                    wasmModuleId: context.WasmFlowRuntime.wasmModuleId,
                    port: p,
                    server: sock,
                    group
                });
            }

            sock.send(
                payload,
                0,
                payload.length,
                port,
                multicast != MODE_MULTICAST ? address : group,
                function (err, bytes) {
                    if (err) {
                        context.throwError(err.toString());
                    }
                    context.propagateValueThroughSeqout();
                    context.endAsyncExecution();
                }
            );
        }
    });

    multicast: string;
    address: string;
    group: string;
    iface: string;
    port: string;
    ipv: string;
    outportType: string;
    outport: string;
    payload: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            multicast: observable,
            address: observable,
            group: observable,
            iface: observable,
            port: observable,
            ipv: observable,
            outportType: observable,
            outport: observable,
            payload: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as const,
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
                type: "null" as const,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {`Send a ${
                        this.multicast == "udp"
                            ? `UDP message: ${this.payload}\nTo address: ${this.address}`
                            : this.multicast == `broadcast`
                            ? `Broadcast message: ${this.payload}\nTo address: ${this.address}`
                            : `Multicast message: ${this.payload}\nTo group: ${
                                  this.group
                              }${
                                  this.iface
                                      ? `\nOn local interface: ${this.iface}`
                                      : ""
                              }`
                    }\nOn port: ${this.port}\nUsing: ${
                        this.ipv == "udp4" ? "IPv4" : "IPv6"
                    }\nBind to ${
                        this.outportType == "random"
                            ? "random local port"
                            : `fixed local port: ${this.outport}`
                    }`}
                </pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeUint8(
            this.multicast == "broadcast"
                ? MODE_BROADCAST
                : this.multicast == "multicast"
                ? MODE_MULTICAST
                : MODE_UDP
        );
        dataBuffer.writeUint8(this.ipv == "udp6" ? IPV6 : IPV4);
        dataBuffer.writeUint8(
            this.outportType == "random"
                ? OUTPORT_TYPE_RANDOM
                : OUTPORT_TYPE_FIXED
        );
    }
}

registerClass("UDPOutActionComponent", UDPOutActionComponent);
