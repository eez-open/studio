import type { BaseList } from "instrument/window/lists/store-renderer";
import { TableList } from "instrument/window/lists/table";
import { EnvelopeList } from "instrument/window/lists/envelope";
import type { IInstrumentObject } from "instrument/window/history/history";

export function getTableListData(
    list: BaseList,
    instrument: IInstrumentObject
) {
    if (list instanceof TableList) {
        return list.data;
    } else if (list instanceof EnvelopeList) {
        const envelopeListData = list.data;

        const { voltage, current, numSamples, duration } = envelopeListData;

        let timeN = [0];
        let iVoltage = 1;
        let iCurrent = 1;
        while (iVoltage < voltage.length || iCurrent < current.length) {
            if (iCurrent === current.length) {
                timeN.push(voltage[iVoltage].time);
                iVoltage++;
            } else if (iVoltage === voltage.length) {
                timeN.push(current[iCurrent].time);
                iCurrent++;
            } else {
                let voltageTime = voltage[iVoltage].time;
                let currentTime = current[iCurrent].time;
                if (voltageTime < currentTime) {
                    timeN.push(voltageTime);
                    iVoltage++;
                } else if (currentTime < voltageTime) {
                    timeN.push(currentTime);
                    iCurrent++;
                } else {
                    timeN.push(voltageTime);
                    iVoltage++;
                    iCurrent++;
                }
            }
        }

        let timeTemp = [0];
        const minDwell = instrument.listsMinDwellProperty;
        const maxDwell = instrument.listsMaxDwellProperty;
        for (let i = 1; i < timeN.length; i++) {
            let dt = timeN[i] - timeTemp[timeTemp.length - 1];
            while (dt > maxDwell) {
                timeTemp.push(timeTemp[timeTemp.length - 1] + maxDwell);
                dt -= maxDwell;
            }
            timeTemp.push(
                timeTemp[timeTemp.length - 1] + Math.max(dt, minDwell)
            );
        }

        timeN = timeTemp;

        let voltageN = [voltage[0].value];
        let currentN = [current[0].value];
        iVoltage = 1;
        iCurrent = 1;
        for (let i = 1; i < timeN.length; i++) {
            while (
                iVoltage < voltage.length &&
                voltage[iVoltage].time < timeN[i]
            ) {
                iVoltage++;
            }
            if (iVoltage === voltage.length) {
                voltageN.push(voltage[voltage.length - 1].value);
            } else {
                voltageN.push(
                    voltage[iVoltage - 1].value +
                        ((timeN[i] - voltage[iVoltage - 1].time) /
                            (voltage[iVoltage].time -
                                voltage[iVoltage - 1].time)) *
                            (voltage[iVoltage].value -
                                voltage[iVoltage - 1].value)
                );
            }

            while (
                iCurrent < current.length &&
                current[iCurrent].time < timeN[i]
            ) {
                iCurrent++;
            }
            if (iCurrent === current.length) {
                currentN.push(current[current.length - 1].value);
            } else {
                currentN.push(
                    current[iCurrent - 1].value +
                        ((timeN[i] - current[iCurrent - 1].time) /
                            (current[iCurrent].time -
                                current[iCurrent - 1].time)) *
                            (current[iCurrent].value -
                                current[iCurrent - 1].value)
                );
            }
        }

        for (let i = 0; i < timeN.length; i++) {
            if (timeN[i] >= duration) {
                if (timeN[i] > duration) {
                    voltageN[i] =
                        voltageN[i - 1] +
                        ((duration - timeN[i - 1]) /
                            (timeN[i] - timeN[i - 1])) *
                            (voltageN[i] - voltageN[i - 1]);

                    currentN[i] =
                        currentN[i - 1] +
                        ((duration - timeN[i - 1]) /
                            (timeN[i] - timeN[i - 1])) *
                            (currentN[i] - currentN[i - 1]);

                    timeN[i] = duration;
                }

                timeN = timeN.slice(0, i + 1);
                voltageN = voltageN.slice(0, i + 1);
                currentN = currentN.slice(0, i + 1);
                break;
            }
        }

        if (timeN[timeN.length - 1] !== duration) {
            timeN.push(duration);
            voltageN.push(voltage[voltage.length - 1].value);
            currentN.push(current[current.length - 1].value);
        }

        let T = 0;
        let N = numSamples;

        for (let i = 1; i < timeN.length; i++) {
            if (
                voltageN[i] === voltageN[i - 1] &&
                currentN[i] === currentN[i - 1]
            ) {
                N--;
            } else {
                T += timeN[i] - timeN[i - 1];
            }
        }

        const dwellS = [];
        const voltageS = [];
        const currentS = [];

        for (let i = 1; i < timeN.length; i++) {
            let dt = timeN[i] - timeN[i - 1];

            if (
                voltageN[i] === voltageN[i - 1] &&
                currentN[i] === currentN[i - 1]
            ) {
                dwellS.push(dt);
                voltageS.push(voltageN[i]);
                currentS.push(currentN[i]);
            } else {
                let n = Math.round((N * dt) / T);

                let dwellSum = 0;
                let dVoltage = voltageN[i] - voltageN[i - 1];
                let dCurrent = currentN[i] - currentN[i - 1];

                for (let j = 0; j < n; j++) {
                    let dwell = (dt - dwellSum) / (n - j);
                    dwellS.push(dwell);

                    voltageS.push(
                        voltageN[i - 1] +
                            ((dwellSum + dwell / 2) * dVoltage) / dt
                    );
                    currentS.push(
                        currentN[i - 1] +
                            ((dwellSum + dwell / 2) * dCurrent) / dt
                    );

                    dwellSum += dwell;
                }

                N -= n;
                T -= dwellSum;
            }
        }

        return {
            dwell: dwellS,
            voltage: voltageS,
            current: currentS
        };
    } else {
        throw "UNKNOWN LIST TYPE";
    }
}
