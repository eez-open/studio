import type { IInstrumentExtensionProperties } from "instrument/instrument-extension";

export const DEFAULT_INSTRUMENT_PROPERTIES: IInstrumentExtensionProperties = {
    properties: {
        connection: {
            ethernet: {
                port: 5025
            },
            serial: {
                baudRates: [4800, 9600, 19200, 38400, 57600, 74880, 115200],
                defaultBaudRate: 9600,
                defaultDataBits: 8,
                defaultStopBits: 1,
                defaultParity: "none",
                defaultFlowControl: "none"
            }
        },
        channels: [
            {
                maxVoltage: 40,
                maxCurrent: 5
            },
            {
                maxVoltage: 40,
                maxCurrent: 5
            }
        ]
    }
};
