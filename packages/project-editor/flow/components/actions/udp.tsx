import React from "react";
import { makeObservable, observable } from "mobx";
import type { Socket, SocketType } from "dgram";

import {
    ActionComponent,
    makeExpressionProperty
} from "project-editor/flow/component";
import { UDP_IN_ICON, UDP_OUT_ICON } from "project-editor/ui-components/icons";

import type { IDashboardComponentContext } from "eez-studio-types";
import {
    makeDerivedClassInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { Assets, DataBuffer } from "project-editor/build/assets";
import type { IComponentExecutionState } from "project-editor/flow/runtime/component-execution-states";
import { registerSystemStructure } from "project-editor/features/variable/value-type";

const componentHeaderColor = "#cca3ba";

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

const udpInputPortsInUse: { [port: number]: Socket } = {};

class UDPInExecutionState implements IComponentExecutionState {
    constructor(
        public context: IDashboardComponentContext,
        public server: Socket,
        public port: number,
        public group: string | undefined
    ) {}

    onDestroy() {
        try {
            if (this.group) {
                this.server.dropMembership(this.group);
            }
            this.server.close();
        } catch (err) {
            //node.error(err);
        }

        if (udpInputPortsInUse.hasOwnProperty(this.port)) {
            delete udpInputPortsInUse[this.port];
        }

        this.context.endAsyncExecution();
    }
}

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
                    disabled: (object: UDPInActionComponent) =>
                        object.multicast !== "multicast"
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
            {
                name: "ipv",
                displayName: "IPv",
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
        componentPaletteGroupName: "UDP",

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

            const multicast = context.getUint8Param(0) == 1;

            let group: string | undefined;
            let iface: string | undefined;
            if (multicast) {
                group = context.evalProperty<string>("group");
                if (group == undefined || typeof group != "string") {
                    context.throwError(`invalid Group property`);
                    return;
                }

                iface = context.evalProperty<string>("iface");
                if (iface == undefined || typeof iface != "string") {
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
                context.getUint8Param(1) == 1 ? "udp6" : "udp4";

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
                        // node.warn(RED._("udp.errors.ifnotfound",{iface:node.iface}));
                        // context.throwError(`invalid Local interface property`);
                        iface = undefined;
                    }
                } else {
                    // node.warn(RED._("udp.errors.ifnotfound",{iface:node.iface}));
                    // context.throwError(`invalid Local interface property`);
                    iface = undefined;
                }
            }

            context.startAsyncExecution();

            var opts = { type: ipv, reuseAddr: true };
            var server: Socket;

            if (!udpInputPortsInUse.hasOwnProperty(port)) {
                server = dgram.createSocket(opts);
                server.bind(port, function () {
                    if (multicast && group) {
                        server.setBroadcast(true);
                        server.setMulticastLoopback(false);
                        // if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
                        // node.log(RED._("udp.status.mc-group",{group:node.group}));
                        try {
                            server.setMulticastTTL(128);
                            server.addMembership(group, iface);
                        } catch (err) {
                            // if (e.errno == "EINVAL") {
                            //     node.error(RED._("udp.errors.bad-mcaddress"));
                            // } else if (e.errno == "ENODEV") {
                            //     node.error(RED._("udp.errors.interface"));
                            // } else {
                            //     node.error(RED._("udp.errors.error",{error:e.errno}));
                            // }
                            context.throwError(err.toString());
                        }
                    }
                });
                udpInputPortsInUse[port] = server;
            } else {
                // node.log(RED._("udp.errors.alreadyused",{port:node.port}));
                server = udpInputPortsInUse[port]; // re-use existing
                // if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
            }

            server.on("error", function (err) {
                // if ((err.code == "EACCES") && (node.port < 1024)) {
                //     node.error(RED._("udp.errors.access-error"));
                // } else {
                //     node.error(RED._("udp.errors.error",{error:err.code}));
                // }

                context.throwError(err.toString());
                server.close();

                context.endAsyncExecution();
            });

            server.on("message", function (message, remote) {
                // var msg;
                // if (node.datatype =="base64") {
                //     msg = { payload:message.toString('base64'), fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
                // } else if (node.datatype =="utf8") {
                //     msg = { payload:message.toString('utf8'), fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
                // } else {
                //     msg = { payload:message, fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
                // }
                // node.send(msg);

                context.propagateValue("message", {
                    payload: message,
                    address: remote.address,
                    port: remote.port
                });
            });

            server.on("listening", function () {
                // var address = server.address();
                // node.log(RED._("udp.status.listener-at",{host:node.iface||address.address,port:address.port}));

                var address = server.address();
                console.log(iface, address);
            });

            const executionState = new UDPInExecutionState(
                context,
                server,
                port,
                group
            );
            context.setComponentExecutionState(executionState);
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
        return null;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeUint8(this.multicast == "multicast" ? 1 : 0);
        dataBuffer.writeUint8(this.ipv == "udp6" ? 1 : 0);
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
                    name: "group",
                    displayName: (object: UDPOutActionComponent) =>
                        object.multicast == "multicast" ? "Group" : "Address",
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
                    disabled: (object: UDPOutActionComponent) =>
                        object.multicast !== "multicast"
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
            {
                name: "ipv",
                displayName: "IPv",
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
                    name: "localPort",
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
        componentPaletteGroupName: "UDP",

        defaultValue: {
            multicast: "udp",
            group: "",
            iface: "",
            port: "",
            ipv: "udp4",
            outportType: "random"
        },

        execute: (context: IDashboardComponentContext) => {
            var os = require("os") as typeof import("os");
            var dgram = require("dgram") as typeof import("dgram");

            const multicast = context.getUint8Param(0);

            let group: string | undefined;
            let iface: string | undefined;
            if (multicast) {
                group = context.evalProperty<string>("group");
                if (group == undefined || typeof group != "string") {
                    context.throwError(`invalid Group property`);
                    return;
                }

                iface = context.evalProperty<string>("iface");
                if (iface == undefined || typeof iface != "string") {
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
                context.getUint8Param(1) == 1 ? "udp6" : "udp4";

            const fixedOutport = context.getUint8Param(2) == 0;

            let outport: number | undefined;
            if (fixedOutport) {
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
                        // node.warn(RED._("udp.errors.ifnotfound",{iface:node.iface}));
                        iface = undefined;
                    }
                } else {
                    // node.warn(RED._("udp.errors.ifnotfound",{iface:node.iface}));
                    iface = undefined;
                }
            }

            var opts = { type: ipv, reuseAddr: true };

            var sock: Socket;

            var p = outport || port || 0;

            if (p != 0 && udpInputPortsInUse[p]) {
                sock = udpInputPortsInUse[p];
                if (multicast != 0) {
                    sock.setBroadcast(true);
                    sock.setMulticastLoopback(false);
                }
                // node.log(RED._("udp.status.re-use",{outport:node.outport,host:node.addr,port:node.port}));
                // if (iface) {
                //     node.status({text:n.iface+" : "+node.iface});
                // }
            } else {
                sock = dgram.createSocket(opts); // default to udp4
                if (multicast != 0) {
                    sock.bind(outport, function () {
                        // have to bind before you can enable broadcast...
                        sock.setBroadcast(true); // turn on broadcast
                        sock.setMulticastLoopback(false); // turn off loopback
                        if (multicast == 1 && group) {
                            try {
                                sock.setMulticastTTL(128);
                                sock.addMembership(group, iface); // Add to the multicast group
                                // if (iface) {
                                //     node.status({text:n.iface+" : "+node.iface});
                                // }
                                // node.log(RED._("udp.status.mc-ready",{iface:node.iface,outport:node.outport,host:node.addr,port:node.port}));
                            } catch (e) {
                                // if (e.errno == "EINVAL") {
                                //     node.error(RED._("udp.errors.bad-mcaddress"));
                                // } else if (e.errno == "ENODEV") {
                                //     node.error(RED._("udp.errors.interface"));
                                // } else {
                                //     node.error(RED._("udp.errors.error",{error:e.errno}));
                                // }
                                context.throwError(e.toString());
                            }
                        } else {
                            // node.log(RED._("udp.status.bc-ready",{outport:node.outport,host:node.addr,port:node.port}));
                        }
                    });
                } else if (
                    outport !== undefined &&
                    !udpInputPortsInUse[outport]
                ) {
                    sock.bind(outport);
                    // node.log(RED._("udp.status.ready",{outport:node.outport,host:node.addr,port:node.port}));
                } else {
                    // node.log(RED._("udp.status.ready-nolocal",{host:node.addr,port:node.port}));
                }

                sock.on("error", function (err) {
                    // Any async error will also get reported in the sock.send call.
                    // This handler is needed to ensure the error marked as handled to
                    // prevent it going to the global error handler and shutting node-red
                    // down.
                });

                udpInputPortsInUse[p] = sock;
            }

            // node.on("input", function(msg, nodeSend, nodeDone) {
            //     if (msg.hasOwnProperty("payload")) {
            //         var add = node.addr || msg.ip || "";
            //         var por = node.port || msg.port || 0;
            //         if (add === "") {
            //             node.warn(RED._("udp.errors.ip-notset"));
            //             nodeDone();
            //         } else if (por === 0) {
            //             node.warn(RED._("udp.errors.port-notset"));
            //             nodeDone();
            //         } else if (isNaN(por) || (por < 1) || (por > 65535)) {
            //             node.warn(RED._("udp.errors.port-invalid"));
            //             nodeDone();
            //         } else {
            //             var message;
            //             if (node.base64) {
            //                 message = Buffer.from(msg.payload, 'base64');
            //             } else if (msg.payload instanceof Buffer) {
            //                 message = msg.payload;
            //             } else {
            //                 message = Buffer.from(""+msg.payload);
            //             }
            //             sock.send(message, 0, message.length, por, add, function(err, bytes) {
            //                 if (err) {
            //                     node.error("udp : "+err,msg);
            //                 }
            //                 message = null;
            //                 nodeDone();
            //             });
            //         }
            //     }
            // });

            context.startAsyncExecution();

            sock.send(
                payload,
                0,
                payload.length,
                port,
                group,
                function (err, bytes) {
                    if (err) {
                        context.throwError(err.toString());
                    }
                    context.endAsyncExecution();
                }
            );
        }
    });

    multicast: string;
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
        return null;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeUint8(
            this.multicast == "broadcast"
                ? 2
                : this.multicast == "multicast"
                ? 1
                : 0
        );
        dataBuffer.writeUint8(this.ipv == "udp6" ? 1 : 0);
        dataBuffer.writeUint8(this.outportType == "random" ? 1 : 0);
    }
}

registerClass("UDPOutActionComponent", UDPOutActionComponent);
