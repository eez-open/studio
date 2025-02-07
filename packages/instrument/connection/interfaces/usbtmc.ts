import type usbTypes from "usb";

import type * as UsbModule from "usb";

////////////////////////////////////////////////////////////////////////////////

let usbModule: typeof UsbModule;
function getUsbModule() {
    if (!usbModule) {
        usbModule = require("usb") as typeof UsbModule;
    }
    return usbModule;
}

////////////////////////////////////////////////////////////////////////////////

// This is port of https://github.com/python-ivi/python-usbtmc,
// latest commit was d9bfb20b2ef002da787adb6b093e1679705c00e2

// constants
const USBTMC_bInterfaceClass = 0xfe;
const USBTMC_bInterfaceSubClass = 3;
// const USBTMC_bInterfaceProtocol = 0;
const USB488_bInterfaceProtocol = 1;

const USBTMC_MSGID_DEV_DEP_MSG_OUT = 1;
// const USBTMC_MSGID_REQUEST_DEV_DEP_MSG_IN = 2;
const USBTMC_MSGID_DEV_DEP_MSG_IN = 2;
const USBTMC_MSGID_VENDOR_SPECIFIC_OUT = 126;
// const USBTMC_MSGID_REQUEST_VENDOR_SPECIFIC_IN = 127;
const USBTMC_MSGID_VENDOR_SPECIFIC_IN = 127;
const USB488_MSGID_TRIGGER = 128;

const USBTMC_STATUS_SUCCESS = 0x01;
const USBTMC_STATUS_PENDING = 0x02;
// const USBTMC_STATUS_FAILED = 0x80;
// const USBTMC_STATUS_TRANSFER_NOT_IN_PROGRESS = 0x81;
// const USBTMC_STATUS_SPLIT_NOT_IN_PROGRESS = 0x82;
// const USBTMC_STATUS_SPLIT_IN_PROGRESS = 0x83;
// const USB488_STATUS_INTERRUPT_IN_BUSY = 0x20;

const USBTMC_REQUEST_INITIATE_ABORT_BULK_OUT = 1;
const USBTMC_REQUEST_CHECK_ABORT_BULK_OUT_STATUS = 2;
const USBTMC_REQUEST_INITIATE_ABORT_BULK_IN = 3;
const USBTMC_REQUEST_CHECK_ABORT_BULK_IN_STATUS = 4;
const USBTMC_REQUEST_INITIATE_CLEAR = 5;
const USBTMC_REQUEST_CHECK_CLEAR_STATUS = 6;
const USBTMC_REQUEST_GET_CAPABILITIES = 7;
const USBTMC_REQUEST_INDICATOR_PULSE = 64;

// const USB488_READ_STATUS_BYTE = 128;
// const USB488_REN_CONTROL = 160;
// const USB488_GOTO_LOCAL = 161;
// const USB488_LOCAL_LOCKOUT = 162;

const USBTMC_HEADER_SIZE = 12;

const RIGOL_QUIRK_PIDS = [0x04ce, 0x0588];

const CTRL_IN = 0x80;
const CTRL_TYPE_CLASS = 1 << 5;
const CTRL_RECIPIENT_INTERFACE = 1;
const CTRL_RECIPIENT_ENDPOINT = 2;

function parse_visa_resource_string(resource_string: string) {
    // valid resource strings:
    // USB::1234::5678::INSTR
    // USB::1234::5678::SERIAL::INSTR
    // USB0::0x1234::0x5678::INSTR
    // USB0::0x1234::0x5678::SERIAL::INSTR

    const m = resource_string.match(
        new RegExp(
            "^((USB)\\d*)(::([^\\s:]+))(::([^\\s:]+([.+])?))(::([^\\s:]+))?(::(INSTR))$",
            "i"
        )
    );

    if (m) {
        return {
            type: m[2].toUpperCase(),
            prefix: m[1],
            arg1: m[4],
            arg2: m[6],
            arg3: m[9],
            suffix: m[11]
        };
    }

    return undefined;
}

function build_request_type(
    direction: number,
    type: number,
    recipient: number
) {
    // Build a bmRequestType field for control requests.

    // These is a conventional function to build a bmRequestType
    // for a control request.

    // The direction parameter can be CTRL_OUT or CTRL_IN.
    // The type parameter can be CTRL_TYPE_STANDARD, CTRL_TYPE_CLASS,
    // CTRL_TYPE_VENDOR or CTRL_TYPE_RESERVED values.
    // The recipient can be CTRL_RECIPIENT_DEVICE, CTRL_RECIPIENT_INTERFACE,
    // CTRL_RECIPIENT_ENDPOINT or CTRL_RECIPIENT_OTHER.

    // Return the bmRequestType value.

    return recipient | type | direction;
}

// Exceptions
class UsbtmcException {
    em: {
        [key: number]: string;
    } = {
        0: "No error"
    };

    err: any;
    note: string | undefined;
    msg: string | undefined;

    constructor(err?: string | number, note?: string) {
        this.err = err;
        this.note = note;
        this.msg = "";

        if (!err) {
            this.msg = note;
        } else {
            if (typeof err === "number") {
                if (this.em[err] !== undefined) {
                    this.msg = `${err}: ${this.em[err]}`;
                } else {
                    this.msg = `${err}: Unknown error`;
                }
            } else {
                this.msg = err;
            }
            if (note) {
                this.msg = `${this.msg} ${note}`;
            }
        }
    }

    toString() {
        return this.msg;
    }
}

function isTimeoutError(err: any) {
    return err.errno === 2;
}

// USBTMC instrument interface client
export class Instrument {
    idVendor: number;
    idProduct: number;
    iSerial: any = null;
    device: usbTypes.Device;
    //cfg: any = null;
    iface: usbTypes.Interface;
    term_char: any = null;

    bcdUSBTMC: number = 0;
    support_pulse: boolean = false;
    support_talk_only: boolean = false;
    support_listen_only: boolean = false;
    support_term_char: boolean = false;

    bcdUSB488: number = 0;
    support_USB4882: boolean = false;
    support_remote_local: boolean = false;
    support_trigger: boolean = false;
    support_scpi: boolean = false;
    support_SR: boolean = false;
    support_RL: boolean = false;
    support_DT: boolean = false;

    max_transfer_size: number = 1024 * 1024;

    _timeout: number = 500;

    bulk_in_ep: usbTypes.InEndpoint;
    bulk_out_ep: usbTypes.OutEndpoint;
    interrupt_in_ep: usbTypes.InEndpoint | null = null;

    last_btag: number = 0;
    last_rstb_btag: number = 0;

    connected: boolean = false;
    reattach: any = [];
    //old_cfg: any = null;

    // quirks
    advantest_quirk: boolean = false;
    advantest_locked: boolean = false;

    rigol_quirk: boolean = false;
    rigol_quirk_ieee_block: boolean = false;

    constructor(...args: any[]) {
        let resource: string | null = null;

        const usb = getUsbModule();

        if (args.length === 1) {
            if (typeof args[0] === "string") {
                resource = args[0];
            } else if (args[0] instanceof usb.Device) {
                this.device = args[0];
            } else if (typeof args[0] === "object") {
                if (args[0].idVendor) {
                    this.idVendor = args[0].idVendor;
                }
                if (args[0].idVendor) {
                    this.idVendor = args[0].idVendor;
                }
                if (args[0].idProduct) {
                    this.idProduct = args[0].idProduct;
                }
                if (args[0].iSerial) {
                    this.iSerial = args[0].iSerial;
                }
                if (args[0].device) {
                    this.device = args[0].device;
                }
                if (args[0].dev) {
                    this.device = args[0].dev;
                }
                if (args[0].term_char) {
                    this.term_char = args[0].term_char;
                }
                if (args[0].resource) {
                    resource = args[0].resource;
                }
            }
        }

        if (args.length >= 2) {
            this.idVendor = args[0];
            this.idProduct = args[1];
        }

        if (args.length >= 3) {
            this.iSerial = args[2];
        }

        if (resource) {
            const res = parse_visa_resource_string(resource);
            if (!res) {
                throw new UsbtmcException("Invalid resource string", "init");
            }

            if (res.arg1 === undefined && res.arg2 === undefined) {
                throw new UsbtmcException("Invalid resource string", "init");
            }

            this.idVendor = parseInt(res.arg1);
            this.idProduct = parseInt(res.arg2);
            this.iSerial = res.arg3;
        }

        // find device
        if (!this.device) {
            if (this.idVendor === undefined || this.idProduct === undefined) {
                throw new UsbtmcException("No device specified", "init");
            } else {
                (this.device as any) = usb.findByIds(
                    this.idVendor,
                    this.idProduct
                );
                if (!this.device) {
                    throw new UsbtmcException("Device not found", "init");
                }
            }
        }
    }

    destroy() {
        if (this.connected) {
            this.close();
        }
    }

    get timeout() {
        return this._timeout;
    }

    set timeout(value: number) {
        this._timeout = value;
    }

    deviceControlTransfer(
        bmRequestType: number,
        bRequest: number,
        wValue: number,
        wIndex: number,
        data_or_length: any
    ) {
        return new Promise<{
            err: any;
            buffer: number | Buffer | undefined;
        }>(resolve => {
            this.device.timeout = this._timeout;
            this.device.controlTransfer(
                bmRequestType,
                bRequest,
                wValue,
                wIndex,
                data_or_length,
                (err, buffer) => {
                    resolve({ err, buffer });
                }
            );
        });
    }

    async open() {
        if (this.connected) {
            return;
        }

        // initialize device

        if (
            this.device.deviceDescriptor.idVendor === 0x0957 &&
            [0x2818, 0x4218, 0x4418].indexOf(
                this.device.deviceDescriptor.idProduct
            ) !== -1
        ) {
            // Agilent U27xx modular devices
            // U2701A/U2702A, U2722A/U2723A
            // These devices require a short initialization sequence, presumably
            // to take them out of 'firmware update' mode after confirming
            // that the firmware version is correct. This is required once
            // on every power-on before the device can be used.
            // Note that the device will reset and the product ID will change.
            // U2701A/U2702A boot 0x2818, usbtmc 0x2918
            // U2722A boot 0x4218, usbtmc 0x4118
            // U2723A boot 0x4418, usbtmc 0x4318

            // let serial = this.device.deviceDescriptor.iSerialNumber;

            let new_id = 0;

            if (this.device.deviceDescriptor.idProduct == 0x2818) {
                // U2701A/U2702A
                new_id = 0x2918;
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x047e,
                    0x0001
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x047d,
                    0x0006
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x0484,
                    0x0005
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x0472,
                    0x000c
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x047a,
                    0x0001
                );
                await this.deviceControlTransfer(
                    0x40,
                    0x0c,
                    0x0000,
                    0x0475,
                    Buffer.from("\x00\x00\x01\x01\x00\x00\x08\x01")
                );
            }

            if (
                [0x4218, 0x4418].indexOf(
                    this.device.deviceDescriptor.idProduct
                ) !== -1
            ) {
                // U2722A/U2723A
                if (this.device.deviceDescriptor.idProduct === 0x4218) {
                    // U2722A
                    new_id = 0x4118;
                } else if (this.device.deviceDescriptor.idProduct === 0x4418) {
                    // U2723A
                    new_id = 0x4318;
                }
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x047e,
                    0x0001
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x047d,
                    0x0006
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x0487,
                    0x0005
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x0472,
                    0x000c
                );
                await this.deviceControlTransfer(
                    0xc0,
                    0x0c,
                    0x0000,
                    0x047a,
                    0x0001
                );
                await this.deviceControlTransfer(
                    0x40,
                    0x0c,
                    0x0000,
                    0x0475,
                    Buffer.from("\x00\x00\x01\x01\x00\x00\x08\x01")
                );
            }

            (this.device as any) = undefined;

            const usb = getUsbModule();

            for (let i = 0; i < 40; i++) {
                (this.device as any) = usb.findByIds(0x0957, new_id);
                if (this.device) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!this.device) {
                throw new UsbtmcException(
                    "Agilent U27xx modular device initialization failed"
                );
            }
        }

        this.device.open();

        // find first USBTMC interface
        if (this.device.interfaces) {
            for (let iface of this.device.interfaces) {
                if (
                    iface.descriptor.bInterfaceClass ===
                        USBTMC_bInterfaceClass &&
                    iface.descriptor.bInterfaceSubClass ===
                        USBTMC_bInterfaceSubClass
                ) {
                    // USBTMC device
                    //this.cfg = ???;
                    this.iface = iface;
                    break;
                } else if (this.device.deviceDescriptor.idVendor === 0x1334) {
                    // Advantest
                    //this.cfg = ???;
                    this.iface = iface;
                    break;
                }
            }
        }

        if (!this.iface) {
            throw new UsbtmcException("Not a USBTMC device", "init");
        }

        // try:
        //     self.old_cfg = self.device.get_active_configuration()
        // except usb.core.USBError:
        //     # ignore exception if configuration is not set
        //     pass

        // if self.old_cfg is not None and self.old_cfg.bConfigurationValue == self.cfg.bConfigurationValue:
        //     # already set to correct configuration

        //     # release kernel driver on USBTMC interface
        //     self._release_kernel_driver(self.iface.bInterfaceNumber)
        // else:
        //     # wrong configuration or configuration not set

        //     # release all kernel drivers
        //     if self.old_cfg is not None:
        //         for iface in self.old_cfg:
        //             self._release_kernel_driver(iface.bInterfaceNumber)

        //     # set proper configuration
        //     self.device.set_configuration(self.cfg)

        // claim interface
        const os = require("os");
        if (os.platform() != "win32") {
            if (this.iface.isKernelDriverActive()) {
                this.iface.detachKernelDriver();
            }
        }
        this.iface.claim();

        const usb = getUsbModule();

        // don't need to set altsetting - USBTMC devices have 1 altsetting as per the spec

        // find endpoints
        for (let i = 0; i < this.iface.endpoints.length; i++) {
            if (
                this.iface.endpoints[i].transferType ===
                usb.usb.LIBUSB_TRANSFER_TYPE_BULK
            ) {
                if (this.iface.endpoints[i] instanceof usb.InEndpoint) {
                    this.bulk_in_ep = this.iface.endpoints[
                        i
                    ] as usbTypes.InEndpoint;
                } else {
                    this.bulk_out_ep = this.iface.endpoints[
                        i
                    ] as usbTypes.OutEndpoint;
                }
            } else if (
                this.iface.endpoints[i].transferType ===
                usb.usb.LIBUSB_TRANSFER_TYPE_INTERRUPT
            ) {
                if (this.iface.endpoints[i] instanceof usb.InEndpoint) {
                    this.interrupt_in_ep = this.iface.endpoints[
                        i
                    ] as usbTypes.InEndpoint;
                }
            }
        }

        if (!this.bulk_in_ep || !this.bulk_out_ep) {
            throw new UsbtmcException("Invalid endpoint configuration", "init");
        }

        // set quirk flags if necessary
        if (this.device.deviceDescriptor.idVendor == 0x1334) {
            // Advantest/ADCMT devices have a very odd USBTMC implementation
            // which requires max 63 byte reads and never signals EOI on read
            this.max_transfer_size = 63;
            this.advantest_quirk = true;
        }

        if (
            this.device.deviceDescriptor.idVendor == 0x1ab1 &&
            RIGOL_QUIRK_PIDS.indexOf(this.device.deviceDescriptor.idProduct) !==
                -1
        ) {
            //this.rigol_quirk = true;
            // if (this.device.deviceDescriptor.idProduct == 0x04ce) {
            //     this.rigol_quirk_ieee_block = true;
            // }
        }

        this.connected = true;

        //await this.clear();

        await this.get_capabilities();
    }

    close() {
        if (!this.connected) {
            return;
        }

        this.device.close();
        (this.device as any) = undefined;

        // try:
        //     # reset configuration
        //     if self.cfg.bConfigurationValue != self.old_cfg.bConfigurationValue:
        //         self.device.set_configuration(self.old_cfg)

        //     # try to reattach kernel driver
        //     for iface in self.reattach:
        //         try:
        //             self.device.attach_kernel_driver(iface)
        //         except:
        //             pass
        // except:
        //     pass

        this.reattach = [];

        this.connected = false;
    }

    is_usb488() {
        return (
            this.iface.descriptor.bInterfaceProtocol ===
            USB488_bInterfaceProtocol
        );
    }

    async get_capabilities() {
        if (!this.connected) {
            await this.open();
        }

        const result = await this.deviceControlTransfer(
            build_request_type(
                CTRL_IN,
                CTRL_TYPE_CLASS,
                CTRL_RECIPIENT_INTERFACE
            ),
            USBTMC_REQUEST_GET_CAPABILITIES,
            0x0000,
            this.iface.descriptor.iInterface,
            0x0018
        );

        if (
            !result.err &&
            result.buffer &&
            result.buffer instanceof Buffer &&
            result.buffer[0] == USBTMC_STATUS_SUCCESS
        ) {
            this.bcdUSBTMC = (result.buffer[3] << 8) + result.buffer[2];
            this.support_pulse = (result.buffer[4] & 4) !== 0;
            this.support_talk_only = (result.buffer[4] & 2) !== 0;
            this.support_listen_only = (result.buffer[4] & 1) !== 0;
            this.support_term_char = (result.buffer[5] & 1) !== 0;

            if (this.is_usb488()) {
                this.bcdUSB488 = (result.buffer[13] << 8) + result.buffer[12];
                this.support_USB4882 = (result.buffer[4] & 4) !== 0;
                this.support_remote_local = (result.buffer[4] & 2) !== 0;
                this.support_trigger = (result.buffer[4] & 1) !== 0;
                this.support_scpi = (result.buffer[4] & 8) !== 0;
                this.support_SR = (result.buffer[4] & 4) !== 0;
                this.support_RL = (result.buffer[4] & 2) !== 0;
                this.support_DT = (result.buffer[4] & 1) !== 0;
            }
        } else {
            throw new UsbtmcException(
                "Get capabilities failed",
                "get_capabilities"
            );
        }
    }

    async pulse() {
        // Send a pulse indicator request, this should blink a light
        // for 500-1000ms and then turn off again. (Only if supported)
        if (!this.connected) {
            await this.open();
        }

        if (this.support_pulse) {
            const result = await this.deviceControlTransfer(
                build_request_type(
                    CTRL_IN,
                    CTRL_TYPE_CLASS,
                    CTRL_RECIPIENT_INTERFACE
                ),
                USBTMC_REQUEST_INDICATOR_PULSE,
                0x0000,
                this.iface.descriptor.iInterface,
                0x0001
            );
            if (
                result.err ||
                !result.buffer ||
                !(result.buffer instanceof Buffer) ||
                result.buffer[0] != USBTMC_STATUS_SUCCESS
            ) {
                throw new UsbtmcException("Pulse failed", "pulse");
            }
        }
    }

    // message header management
    pack_bulk_out_header(msgid: number) {
        const btag = (this.last_btag % 255) + 1;
        this.last_btag = btag;

        const buffer = Buffer.alloc(4);

        buffer.writeUInt8(msgid, 0);
        buffer.writeUInt8(btag, 1);
        buffer.writeUInt8(~btag & 0xff, 2);
        buffer.writeUInt8(0, 3);

        return buffer;
    }

    pack_dev_dep_msg_out_header(transfer_size: number, eom = true) {
        const buffer = Buffer.alloc(12);

        const hdr = this.pack_bulk_out_header(USBTMC_MSGID_DEV_DEP_MSG_OUT);
        hdr.copy(buffer, 0);

        buffer.writeUInt32LE(transfer_size, 4);

        buffer.writeUInt8(eom ? 1 : 0, 8);
        buffer.writeUInt8(0, 9);
        buffer.writeUInt8(0, 10);
        buffer.writeUInt8(0, 11);

        return buffer;
    }

    pack_dev_dep_msg_in_header(transfer_size: number, term_char?: any) {
        const buffer = Buffer.alloc(12);

        const hdr = this.pack_bulk_out_header(USBTMC_MSGID_DEV_DEP_MSG_IN);
        hdr.copy(buffer, 0);

        let transfer_attributes;
        if (term_char == null) {
            transfer_attributes = 0;
            term_char = 0;
        } else {
            transfer_attributes = 2;
            term_char = this.term_char;
        }

        buffer.writeUInt32LE(transfer_size, 4);

        buffer.writeUInt8(transfer_attributes, 8);
        buffer.writeUInt8(term_char, 9);
        buffer.writeUInt8(0, 10);
        buffer.writeUInt8(0, 11);

        return buffer;
    }

    pack_vendor_specific_out_header(transfer_size: number) {
        const buffer = Buffer.alloc(12);

        const hdr = this.pack_bulk_out_header(USBTMC_MSGID_VENDOR_SPECIFIC_OUT);
        hdr.copy(buffer, 0);

        buffer.writeUInt32LE(transfer_size, 4);

        buffer.writeUInt8(0, 8);
        buffer.writeUInt8(0, 9);
        buffer.writeUInt8(0, 10);
        buffer.writeUInt8(0, 11);

        return buffer;
    }

    pack_vendor_specific_in_header(transfer_size: number) {
        const buffer = Buffer.alloc(12);

        const hdr = this.pack_bulk_out_header(USBTMC_MSGID_VENDOR_SPECIFIC_IN);
        hdr.copy(buffer, 0);

        buffer.writeUInt32LE(transfer_size, 4);

        buffer.writeUInt8(0, 8);
        buffer.writeUInt8(0, 9);
        buffer.writeUInt8(0, 10);
        buffer.writeUInt8(0, 11);

        return buffer;
    }

    pack_usb488_trigger() {
        const buffer = Buffer.alloc(12);

        const hdr = this.pack_bulk_out_header(USB488_MSGID_TRIGGER);
        hdr.copy(buffer, 0);

        for (let i = 4; i < 12; i++) {
            buffer.writeUInt8(0, i);
        }

        return buffer;
    }

    unpack_bulk_in_header(buffer: Buffer) {
        const msgid = buffer.readUInt8(0);
        const btag = buffer.readUInt8(1);
        const btaginverse = buffer.readUInt8(2);
        return {
            msgid,
            btag,
            btaginverse
        };
    }

    unpack_dev_dep_resp_header(buffer: Buffer) {
        const { msgid, btag, btaginverse } = this.unpack_bulk_in_header(buffer);

        const transfer_size = buffer.readUInt32LE(4);
        const transfer_attributes = buffer.readUInt8(8);

        const data = Buffer.alloc(buffer.length - USBTMC_HEADER_SIZE);
        buffer.copy(data, 0, USBTMC_HEADER_SIZE, buffer.length);

        return {
            msgid,
            btag,
            btaginverse,
            transfer_size,
            transfer_attributes,
            data
        };
    }

    bulk_out_ep_write(buffer: Buffer) {
        return new Promise<void>((resolve, reject) => {
            this.bulk_out_ep.timeout = this._timeout;
            this.bulk_out_ep.transfer(buffer, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async write_raw(data: Buffer) {
        // Write binary data to instrument

        if (!this.connected) {
            await this.open();
        }

        let eom = false;

        let num = data.length;

        let offset = 0;

        try {
            while (num > 0) {
                if (num <= this.max_transfer_size) {
                    eom = true;
                }

                const block = data.slice(
                    offset,
                    offset + this.max_transfer_size
                );
                const size = block.length;

                const req = Buffer.concat([
                    this.pack_dev_dep_msg_out_header(size, eom),
                    block,
                    Buffer.alloc((4 - (size % 4)) % 4)
                ]);

                await this.bulk_out_ep_write(req);

                offset += size;
                num -= size;
            }
        } catch (err) {
            if (isTimeoutError(err)) {
                // timeout, abort transfer
                await this._abort_bulk_out();
            }
            throw err;
        }
    }

    bulk_in_ep_read(length: number) {
        return new Promise<Buffer>((resolve, reject) => {
            this.bulk_in_ep.timeout = this._timeout;
            this.bulk_in_ep.transfer(length, (err: any, data: Buffer) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    async read_raw(onData: (data: any) => boolean) {
        // Read binary data from instrument

        if (!this.connected) {
            await this.open();
        }

        let read_len = this.max_transfer_size;

        let read_data: Buffer = Buffer.alloc(0);

        const SEND_CHUNK_SIZE = 32768;
        let total_data_sent = 0;

        let expect_msg_in_response = true;
        let arbitrary_data = false;
        let first = true;

        let expected_length = 0;

        let eom = false;

        const req = this.pack_dev_dep_msg_in_header(read_len, this.term_char);
        await this.bulk_out_ep_write(req);

        while (true) {
            let received = 0;
            let transfer_size = 0;
            do {
                try {
                    const resp = await this.bulk_in_ep_read(read_len);
                    if (resp.length === 0) {
                        break;
                    }

                    let data: Buffer | undefined = undefined;

                    if (expect_msg_in_response) {
                        expect_msg_in_response = false;

                        let transfer_attributes: number;

                        ({ transfer_size, transfer_attributes, data } =
                            this.unpack_dev_dep_resp_header(resp));

                        eom = transfer_attributes & 1 ? true : false;

                        if (
                            first &&
                            data.length > 0 &&
                            data[0] === "#".charCodeAt(0)
                        ) {
                            first = false;

                            // ieee block incoming, the transfer_size usbtmc header is lying about the transaction size
                            const l = data[1] - "0".charCodeAt(0);
                            const n = parseInt(data.slice(2, l + 2).toString());
                            expected_length = n + (l + 2); // account for ieee header
                            arbitrary_data = true;
                        }

                        if (!arbitrary_data) {
                            expected_length += transfer_size;
                        }
                    } else {
                        data = resp;
                    }

                    received += data.length;

                    read_data = Buffer.concat([read_data, data]);

                    if (read_data.length >= SEND_CHUNK_SIZE) {
                        let continueRead = onData(
                            total_data_sent + read_data.length < expected_length
                                ? read_data
                                : read_data.subarray(
                                      0,
                                      expected_length - total_data_sent
                                  )
                        );
                        if (!continueRead) {
                            await this._abort_bulk_in();
                            return;
                        }

                        total_data_sent += data.length;

                        read_data = Buffer.alloc(0);
                    }
                } catch (err) {
                    if (isTimeoutError(err)) {
                        // timeout, abort transfer
                        await this._abort_bulk_in();
                    }
                    throw err;
                }
            } while (received < transfer_size);

            if (eom) {
                break;
            }

            const req = this.pack_dev_dep_msg_in_header(
                read_len,
                this.term_char
            );
            await this.bulk_out_ep_write(req);

            expect_msg_in_response = true;
        }

        if (read_data.length > 0) {
            onData(
                total_data_sent + read_data.length < expected_length
                    ? read_data
                    : read_data.subarray(0, expected_length - total_data_sent)
            );
        }
    }

    async write(message: string) {
        await this.write_raw(Buffer.from(message, "binary"));
    }

    async clear() {
        // Send clear command

        if (!this.connected) {
            await this.open();
        }

        // Send INITIATE_CLEAR
        const result = await this.deviceControlTransfer(
            build_request_type(
                CTRL_IN,
                CTRL_TYPE_CLASS,
                CTRL_RECIPIENT_INTERFACE
            ),
            USBTMC_REQUEST_INITIATE_CLEAR,
            0x0000,
            this.iface.descriptor.iInterface,
            0x0001
        );
        if (
            !result.err &&
            result.buffer &&
            result.buffer instanceof Buffer &&
            result.buffer[0] == USBTMC_STATUS_SUCCESS
        ) {
            // Initiate clear succeeded, wait for completion
            while (true) {
                const result = await this.deviceControlTransfer(
                    build_request_type(
                        CTRL_IN,
                        CTRL_TYPE_CLASS,
                        CTRL_RECIPIENT_INTERFACE
                    ),
                    USBTMC_REQUEST_CHECK_CLEAR_STATUS,
                    0x0000,
                    this.iface.descriptor.iInterface,
                    0x0002
                );

                if (
                    !result.err &&
                    result.buffer &&
                    result.buffer instanceof Buffer &&
                    result.buffer[0] != USBTMC_STATUS_PENDING
                ) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Clear halt condition
            // @todo
            // this.bulk_out_ep.clear_halt();
        } else {
            throw new UsbtmcException("Clear failed", "clear");
        }
    }

    async _abort_bulk_out(btag: number | null = null) {
        // Abort bulk out

        if (!this.connected) {
            return;
        }

        if (btag == null) {
            btag = this.last_btag;
        }

        // Send INITIATE_ABORT_BULK_OUT
        const result = await this.deviceControlTransfer(
            build_request_type(
                CTRL_IN,
                CTRL_TYPE_CLASS,
                CTRL_RECIPIENT_ENDPOINT
            ),
            USBTMC_REQUEST_INITIATE_ABORT_BULK_OUT,
            btag,
            this.bulk_out_ep.descriptor.bEndpointAddress,
            0x0002
        );
        if (
            !result.err &&
            result.buffer &&
            result.buffer instanceof Buffer &&
            result.buffer[0] == USBTMC_STATUS_SUCCESS
        ) {
            // Initiate abort bulk out succeeded, wait for completion
            while (true) {
                // Check status
                const result = await this.deviceControlTransfer(
                    build_request_type(
                        CTRL_IN,
                        CTRL_TYPE_CLASS,
                        CTRL_RECIPIENT_ENDPOINT
                    ),
                    USBTMC_REQUEST_CHECK_ABORT_BULK_OUT_STATUS,
                    0x0000,
                    this.bulk_out_ep.descriptor.bEndpointAddress,
                    0x0008
                );
                if (
                    !result.err &&
                    result.buffer &&
                    result.buffer instanceof Buffer &&
                    result.buffer[0] != USBTMC_STATUS_PENDING
                ) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } else {
            // no transfer in progress; nothing to do
        }
    }

    async _abort_bulk_in(btag: number | null = null) {
        // Abort bulk in

        if (!this.connected) {
            return;
        }

        if (btag == null) {
            btag = this.last_btag;
        }

        // Send INITIATE_ABORT_BULK_IN
        const result = await this.deviceControlTransfer(
            build_request_type(
                CTRL_IN,
                CTRL_TYPE_CLASS,
                CTRL_RECIPIENT_ENDPOINT
            ),
            USBTMC_REQUEST_INITIATE_ABORT_BULK_IN,
            btag,
            this.bulk_in_ep.descriptor.bEndpointAddress,
            0x0002
        );
        if (
            !result.err &&
            result.buffer &&
            result.buffer instanceof Buffer &&
            result.buffer[0] == USBTMC_STATUS_SUCCESS
        ) {
            // Initiate abort bulk in succeeded, wait for completion
            while (true) {
                // Check status
                const result = await this.deviceControlTransfer(
                    build_request_type(
                        CTRL_IN,
                        CTRL_TYPE_CLASS,
                        CTRL_RECIPIENT_ENDPOINT
                    ),
                    USBTMC_REQUEST_CHECK_ABORT_BULK_IN_STATUS,
                    0x0000,
                    this.bulk_in_ep.descriptor.bEndpointAddress,
                    0x0008
                );
                if (
                    !result.err &&
                    result.buffer &&
                    result.buffer instanceof Buffer &&
                    result.buffer[0] != USBTMC_STATUS_PENDING
                ) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } else {
            // no transfer in progress; nothing to do
        }
    }

    async lock() {
        // Send lock command

        if (!this.connected) {
            await this.open();
        }

        if (this.advantest_quirk) {
            // This Advantest/ADCMT vendor-specific control command enables remote control and must be sent before any commands are exchanged
            // (otherwise READ commands will only retrieve the latest measurement)
            this.advantest_locked = true;
            await this.deviceControlTransfer(0xa1, 0xa0, 0x0001, 0x0000, 1);
        } else {
            throw "not implemented";
        }
    }

    async unlock() {
        // Send unlock command

        if (!this.connected) {
            await this.open();
        }

        if (this.advantest_quirk) {
            // This Advantest/ADCMT vendor-specific control command enables remote control and must be sent before any commands are exchanged
            // (otherwise READ commands will only retrieve the latest measurement)
            this.advantest_locked = false;
            await this.deviceControlTransfer(0xa1, 0xa0, 0x0000, 0x0000, 1);
        } else {
            throw "not implemented";
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

import {
    CommunicationInterface,
    CommunicationInterfaceHost
} from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";

export class UsbTmcInterface implements CommunicationInterface {
    instrument: Instrument | undefined = undefined;
    commands: string[] = [];
    executing: boolean;

    readyToWrite = true;

    abortRead = false;

    constructor(private host: CommunicationInterfaceHost) {
        try {
            const instrument = new Instrument(
                this.host.connectionParameters.usbtmcParameters.idVendor,
                this.host.connectionParameters.usbtmcParameters.idProduct
            );

            instrument
                .open()
                .then(() => {
                    this.instrument = instrument;
                    this.host.connected();
                })
                .catch(err => {
                    this.host.setError(
                        ConnectionErrorCode.NONE,
                        err.toString()
                    );
                    this.destroy();
                });
        } catch (err) {
            this.host.setError(ConnectionErrorCode.NONE, err.toString());
            this.destroy();
        }
    }

    connect() {}

    isConnected() {
        return !!this.instrument;
    }

    read() {
        if (this.instrument) {
            this.readyToWrite = false;

            try {
                this.instrument.read_raw((data: any) => {
                    const dataStr = data.toString("binary");
                    this.host.onData(dataStr);

                    let abortRead = this.abortRead;
                    this.abortRead = false;
                    return !abortRead;
                });
            } catch (err) {
                console.log("catch", err);
            } finally {
                console.log("finally");
                this.readyToWrite = true;
            }
        }
    }

    async waitForReadyToWrite() {
        while (!this.readyToWrite) {
            await new Promise(resolve => setTimeout(resolve));
            if (this.instrument) {
                return;
            }
        }
    }

    async write(data: string) {
        await this.waitForReadyToWrite();

        if (this.instrument) {
            console.log("write", data);
            await this.instrument.write(data);
            this.read();
        }
    }

    async destroy() {
        await this.waitForReadyToWrite();
        if (this.instrument) {
            this.abortRead = true;
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                this.instrument.close();
                this.instrument = undefined;
            } catch (err) {}
        }
        this.host.disconnected();
    }

    disconnect() {
        this.destroy();
    }
}

export async function getUsbDevices() {
    let devices = [];

    const usb = getUsbModule();

    const deviceList = usb.getDeviceList();
    for (const device of deviceList) {
        let productName: string | undefined;

        try {
            device.open();

            productName = await new Promise<string | undefined>(
                (resolve, reject) => {
                    device.getStringDescriptor(
                        device.deviceDescriptor.iProduct,
                        (err, product) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(
                                    product !== undefined
                                        ? product.toString()
                                        : product
                                );
                            }
                        }
                    );
                }
            );

            device.close();
        } catch (err) {}

        devices.push({
            idVendor: device.deviceDescriptor.idVendor,
            idProduct: device.deviceDescriptor.idProduct,
            name: productName
        });
    }

    return devices;
}
