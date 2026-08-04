type UsbDeviceType = any;

function getUsbModule() {
    const usb = require("usb/index.js");
    return {
        nativeFindDeviceByIds: usb.nativeFindDeviceByIds,
        nativeGetDevices: usb.nativeGetDevices,
        UsbDevice: usb.UsbDevice
    };
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

// @ts-ignore - Used for device-specific quirks
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
    device: UsbDeviceType | null = null;
    interfaceNumber: number = 0;
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

    bulk_in_ep: number = 0;
    bulk_out_ep: number = 0;
    interrupt_in_ep: number | null = null;

    last_btag: number = 0;
    last_rstb_btag: number = 0;

    connected: boolean = false;
    reattach: any = [];

    // quirks
    advantest_quirk: boolean = false;
    advantest_locked: boolean = false;

    rigol_quirk: boolean = false;
    rigol_quirk_ieee_block: boolean = false;

    constructor(...args: any[]) {
        const { UsbDevice: UsbDeviceClass } = getUsbModule();
        let resource: string | null = null;

        if (args.length === 1) {
            if (typeof args[0] === "string") {
                resource = args[0];
            } else if (args[0] instanceof UsbDeviceClass) {
                this.device = args[0];
            } else if (typeof args[0] === "object") {
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
    }

    async destroy() {
        if (this.connected) {
            await this.close();
        }
    }

    get timeout() {
        return this._timeout;
    }

    set timeout(value: number) {
        this._timeout = value;
    }

    async deviceControlTransfer(
        bmRequestType: number,
        bRequest: number,
        wValue: number,
        wIndex: number,
        data_or_length: any
    ) {
        const direction = (bmRequestType & 0x80) === 0x80 ? "in" : "out";
        const typeValue = (bmRequestType >> 5) & 0x3;
        const requestTypeMap = ["standard", "class", "vendor"];
        const requestType = requestTypeMap[typeValue] || "vendor";

        const recipientValue = bmRequestType & 0x1f;
        const recipientMap: { [key: number]: string } = {
            0: "device",
            1: "interface",
            2: "endpoint"
        };
        const recipient = recipientMap[recipientValue] || "device";

        const setup: any = {
            requestType,
            recipient,
            request: bRequest,
            value: wValue,
            index: wIndex
        };

        try {
            if (direction === "in") {
                const buffer = await this.device!.nativeControlTransferIn(
                    setup,
                    this._timeout,
                    typeof data_or_length === "number" ? data_or_length : 64
                );
                return { err: null, buffer: buffer ? Buffer.from(buffer) : undefined };
            } else {
                const data = Buffer.isBuffer(data_or_length)
                    ? data_or_length
                    : Buffer.alloc(0);
                await this.device!.nativeControlTransferOut(
                    setup,
                    this._timeout,
                    data
                );
                return { err: null, buffer: undefined };
            }
        } catch (err) {
            return { err, buffer: undefined };
        }
    }

    async open() {
        if (this.connected) {
            return;
        }

        const { nativeFindDeviceByIds } = getUsbModule();

        // find device if not already set
        if (!this.device) {
            if (this.idVendor === undefined || this.idProduct === undefined) {
                throw new UsbtmcException("No device specified", "init");
            }
            this.device = await nativeFindDeviceByIds(
                this.idVendor,
                this.idProduct
            );
            if (!this.device) {
                throw new UsbtmcException("Device not found", "init");
            }
        }

        // initialize device
        if (
            this.device.vendorId === 0x0957 &&
            [0x2818, 0x4218, 0x4418].indexOf(this.device.productId) !== -1
        ) {
            // Agilent U27xx modular devices
            let new_id = 0;

            if (this.device.productId == 0x2818) {
                new_id = 0x2918;
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x047e, 0x0001);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x047d, 0x0006);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x0484, 0x0005);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x0472, 0x000c);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x047a, 0x0001);
                await this.deviceControlTransfer(
                    0x40,
                    0x0c,
                    0x0000,
                    0x0475,
                    Buffer.from("\x00\x00\x01\x01\x00\x00\x08\x01")
                );
            }

            if ([0x4218, 0x4418].indexOf(this.device.productId) !== -1) {
                if (this.device.productId === 0x4218) {
                    new_id = 0x4118;
                } else if (this.device.productId === 0x4418) {
                    new_id = 0x4318;
                }
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x047e, 0x0001);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x047d, 0x0006);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x0487, 0x0005);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x0472, 0x000c);
                await this.deviceControlTransfer(0xc0, 0x0c, 0x0000, 0x047a, 0x0001);
                await this.deviceControlTransfer(
                    0x40,
                    0x0c,
                    0x0000,
                    0x0475,
                    Buffer.from("\x00\x00\x01\x01\x00\x00\x08\x01")
                );
            }

            this.device = null;

            for (let i = 0; i < 40; i++) {
                this.device = await nativeFindDeviceByIds(0x0957, new_id);
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

        await this.device.open();

        // Select the first configuration if not already selected
        try {
            await this.device.selectConfiguration(1);
            console.log("Selected configuration 1");
        } catch (err) {
            console.log(`selectConfiguration error: ${err}`);
        }

        // find first USBTMC interface
        const config = this.device.configuration;
        if (config && config.interfaces) {
            for (const iface of config.interfaces) {
                const alt = iface.alternate;
                if (
                    alt.interfaceClass === USBTMC_bInterfaceClass &&
                    alt.interfaceSubclass === USBTMC_bInterfaceSubClass
                ) {
                    this.interfaceNumber = iface.interfaceNumber;
                    break;
                } else if (this.device.vendorId === 0x1334) {
                    // Advantest
                    this.interfaceNumber = iface.interfaceNumber;
                    break;
                }
            }
        }

        if (this.interfaceNumber === undefined) {
            throw new UsbtmcException("Not a USBTMC device", "init");
        }

        // claim interface
        const os = require("os");
        if (os.platform() !== "win32") {
            try {
                await this.device.detachKernelDriver(this.interfaceNumber);
            } catch (err) {
                // ignore if no kernel driver is attached
            }
        }
        await this.device.claimInterface(this.interfaceNumber);

        // find endpoints
        const alt = config!.interfaces[this.interfaceNumber].alternate;

        // Clear any halt conditions on endpoints
        for (const endpoint of alt.endpoints) {
            if (endpoint.type === "bulk") {
                try {
                    await this.device.clearHalt(endpoint.direction, endpoint.endpointNumber);
                    console.log(`Cleared halt on ${endpoint.direction} endpoint ${endpoint.endpointNumber}`);
                } catch (err) {
                    console.log(`Failed to clear halt: ${err}`);
                }
            }
        }
        for (const endpoint of alt.endpoints) {
            console.log(`Found endpoint: number=${endpoint.endpointNumber}, direction=${endpoint.direction}, type=${endpoint.type}`);
            if (endpoint.type === "bulk") {
                if (endpoint.direction === "in") {
                    this.bulk_in_ep = endpoint.endpointNumber;
                } else {
                    this.bulk_out_ep = endpoint.endpointNumber;
                }
            } else if (endpoint.type === "interrupt") {
                if (endpoint.direction === "in") {
                    this.interrupt_in_ep = endpoint.endpointNumber;
                }
            }
        }

        console.log(`Using endpoints: bulk_in=${this.bulk_in_ep}, bulk_out=${this.bulk_out_ep}`);
        if (!this.bulk_in_ep || !this.bulk_out_ep) {
            throw new UsbtmcException("Invalid endpoint configuration", "init");
        }

        // set quirk flags if necessary
        if (this.device.vendorId == 0x1334) {
            // Advantest/ADCMT devices have a very odd USBTMC implementation
            this.max_transfer_size = 63;
            this.advantest_quirk = true;
        }

        this.connected = true;

        await this.get_capabilities();
    }

    async close() {
        if (!this.connected) {
            return;
        }

        if (this.device) {
            try {
                await this.device.releaseInterface(this.interfaceNumber);
            } catch (err) {
                // ignore errors during release
            }
            try {
                await this.device.close();
            } catch (err) {
                // ignore errors during close
            }
            this.device = null;
        }

        this.reattach = [];
        this.connected = false;
    }

    is_usb488() {
        if (!this.device) return false;
        const config = this.device.configuration;
        if (!config) return false;
        const iface = config.interfaces[this.interfaceNumber];
        if (!iface) return false;
        return iface.alternate.interfaceProtocol === USB488_bInterfaceProtocol;
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
            this.interfaceNumber,
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
                this.interfaceNumber,
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

    async bulk_out_ep_write(buffer: Buffer) {
        try {
            console.log(`bulk_out_ep_write: endpoint=${this.bulk_out_ep}, length=${buffer.length}`);
            const data = new Uint8Array(buffer);
            await this.device!.nativeTransferOut(
                this.bulk_out_ep,
                this._timeout,
                data
            );
            console.log(`bulk_out_ep_write: success`);
        } catch (err) {
            console.log(`bulk_out_ep_write: error=${err}`);
            throw err;
        }
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

    async bulk_in_ep_read(length: number) {
        try {
            console.log(`bulk_in_ep_read: endpoint=${this.bulk_in_ep}, length=${length}`);
            // Limit initial read to a reasonable packet size
            const readLength = Math.min(length, 65536);
            const data = await this.device!.nativeTransferIn(
                this.bulk_in_ep,
                this._timeout,
                readLength
            );
            if (!data || data.length === 0) {
                console.log(`bulk_in_ep_read: no data received or empty response`);
                // Return empty buffer instead of throwing - device might not have data yet
                return Buffer.alloc(0);
            }
            console.log(`bulk_in_ep_read: received ${data.length} bytes`);
            return Buffer.from(data);
        } catch (err) {
            console.log(`bulk_in_ep_read: error=${err}`);
            // Don't throw on read errors - return empty buffer
            // This allows the protocol to continue
            return Buffer.alloc(0);
        }
    }

    async read_raw(onData: (data: any) => boolean) {
        // Read binary data from instrument

        if (!this.connected) {
            await this.open();
        }

        // Use a reasonable initial read size instead of max (1MB)
        let read_len = 65536;

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

        // Add small delay to allow device to prepare response
        await new Promise(resolve => setTimeout(resolve, 10));

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
            this.interfaceNumber,
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
                    this.interfaceNumber,
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
            this.bulk_out_ep,
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
                    this.bulk_out_ep,
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
            this.bulk_in_ep,
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
                    this.bulk_in_ep,
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
        } catch (err: any) {
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

            this.instrument
                .read_raw((data: any) => {
                    const dataStr = data.toString("binary");
                    this.host.onData(dataStr);

                    let abortRead = this.abortRead;
                    this.abortRead = false;
                    return !abortRead;
                })
                .catch((err: any) => {
                    console.log("catch", err);
                })
                .finally(() => {
                    console.log("finally");
                    this.readyToWrite = true;
                });
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
                await this.instrument.close();
                this.instrument = undefined;
            } catch (err) {
                // ignore errors during close
            }
        }
        this.host.disconnected();
    }

    disconnect() {
        this.destroy();
    }
}

export async function getUsbDevices() {
    const { nativeGetDevices } = getUsbModule();
    const devices = [];

    const deviceList = await nativeGetDevices();
    for (const device of deviceList) {
        let productName: string | undefined;

        try {
            await device.open();
            productName = device.productName ?? undefined;
            await device.close();
        } catch (err) {
            // ignore errors
        }

        devices.push({
            idVendor: device.vendorId,
            idProduct: device.productId,
            name: productName
        });
    }

    return devices;
}
