import * as I10nModule from "eez-studio-shared/i10n";
import { UNITS } from "eez-studio-shared/units";
import { decodeDlog, Unit as DlogUnit } from "instrument/window/waveform/dlog-file";

export function dlogUnitToStudioUnit(unit: DlogUnit) {
    if (unit === DlogUnit.UNIT_VOLT) {
        return UNITS.volt;
    } else if (unit === DlogUnit.UNIT_AMPER) {
        return UNITS.ampere;
    } else if (unit === DlogUnit.UNIT_WATT) {
        return UNITS.watt;
    } else if (unit === DlogUnit.UNIT_SECOND) {
        return UNITS.time;
    } else if (unit === DlogUnit.UNIT_JOULE) {
        return UNITS.joule;
    } else {
        return UNITS.unknown;
    }
}

export function convertDlogToCsv(data: Uint8Array) {
    const dlog = decodeDlog(data, dlogUnitToStudioUnit);
    if (!dlog) {
        return undefined;
    }

    const buffer = Buffer.allocUnsafe(4);

    function readFloat(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readFloatLE(0);
    }

    const numColumns = (dlog.hasJitterColumn ? 1 : 0) + dlog.yAxes.length;

    const { getLocale } = require("eez-studio-shared/i10n") as typeof I10nModule;

    const locale = getLocale();

    // determine CSV separator depending of locale usage of ","
    let separator;
    if ((0.1).toLocaleString(locale).indexOf(",") != -1) {
        separator = ";";
    } else {
        separator = ",";
    }

    const numberFormat = new Intl.NumberFormat(locale, {
        useGrouping: false,
        maximumFractionDigits: 9
    });

    // first row contains column names
    let csv = "";

    if (dlog.xAxis.label) {
        csv += dlog.xAxis.label;
    } else {
        csv += dlog.xAxis.unit.name;
    }

    for (let columnIndex = 0; columnIndex < dlog.yAxes.length; columnIndex++) {
        csv += separator;
        if (dlog.yAxes[columnIndex].label) {
            csv += dlog.yAxes[columnIndex].label;
        } else {
            csv += dlog.yAxes[columnIndex].unit.name;
        }
    }

    csv += "\n";

    //
    for (let rowIndex = 0; rowIndex < dlog.length; rowIndex++) {
        csv += numberFormat.format(rowIndex * dlog.xAxis.step);
        for (let columnIndex = 0; columnIndex < dlog.yAxes.length; columnIndex++) {
            csv += separator;
            csv += numberFormat.format(
                readFloat(
                    dlog.dataOffset +
                        4 * (rowIndex * numColumns + (dlog.hasJitterColumn ? 1 : 0) + columnIndex)
                )
            );
        }
        csv += "\n";
    }

    return Buffer.from(csv, "utf8");
}
