import React from "react";
import { observable, runInAction, action } from "mobx";

import { objectClone } from "eez-studio-shared/util";
import { capitalize } from "eez-studio-shared/string";
import { IUnit, SAMPLING_RATE_UNIT, UNITS } from "eez-studio-shared/units";

import { makeValidator, validators } from "eez-studio-shared/validation";

import { TextInputProperty, SelectProperty } from "eez-studio-ui/properties";

import { WaveformFormat } from "eez-studio-ui/chart/chart";
import type { IWaveformDefinition } from "./generic";

////////////////////////////////////////////////////////////////////////////////

export class WaveformDefinitionProperties {
    constructor(public waveformDefinition: IWaveformDefinition) {
        const unit = UNITS[this.waveformDefinition.unitName];

        this.props = {
            samplingRate: SAMPLING_RATE_UNIT.formatValue(
                this.waveformDefinition.samplingRate
            ),
            format: this.waveformDefinition.format,
            unit,
            offset: this.waveformDefinition.offset.toString(),
            scale: this.waveformDefinition.scale.toString()
        };

        this.propsValidated = objectClone(this.waveformDefinition);
    }

    @observable props: {
        samplingRate: string;
        format: WaveformFormat;
        unit: IUnit;
        offset: string;
        scale: string;
    };

    propsValidated: IWaveformDefinition;

    @observable errors: boolean;

    validator = makeValidator({
        samplingRate: [
            validators.required,
            () => {
                let samplingRate = SAMPLING_RATE_UNIT.parseValue(
                    this.props.samplingRate
                );
                if (typeof samplingRate !== "number") {
                    return "Invalid value.";
                }
                this.propsValidated.samplingRate = samplingRate;
                return null;
            },
            () => {
                return validators.rangeExclusive(0)(
                    this.propsValidated,
                    "sampling rate"
                );
            }
        ],

        offset: [
            validators.required,
            () => {
                let offset = parseFloat(this.props.offset);
                if (typeof offset !== "number") {
                    return "Invalid value.";
                }
                this.propsValidated.offset = offset;
                return null;
            }
        ],

        scale: [
            validators.required,
            () => {
                let scale = parseFloat(this.props.scale);
                if (typeof scale !== "number") {
                    return "Invalid value.";
                }
                this.propsValidated.scale = scale;
                return null;
            },
            () => {
                if (this.propsValidated.scale <= 0) {
                    return "Must be greater than 0";
                }
                return null;
            }
        ]
    });

    async checkValidity() {
        const result = await this.validator.checkValidity(this.props);

        runInAction(() => {
            this.errors = !result;
        });

        if (!result) {
            return undefined;
        }

        this.propsValidated.format = this.props.format;
        this.propsValidated.unitName = this.props.unit
            .name as keyof typeof UNITS;

        return this.propsValidated;
    }

    get units(): IUnit[] {
        const units: IUnit[] = [];
        Object.keys(UNITS).forEach((unitName: keyof typeof UNITS) => {
            if (units.indexOf(UNITS[unitName]) === -1) {
                units.push(UNITS[unitName]);
            }
        });
        return units;
    }

    render() {
        return [
            <TextInputProperty
                key="samplingRate"
                name="Sampling rate"
                value={this.props.samplingRate}
                onChange={action(
                    (value: string) => (this.props.samplingRate = value)
                )}
                errors={this.validator.errors.samplingRate}
            />,
            <SelectProperty
                key="format"
                name="Format"
                value={this.props.format.toString()}
                onChange={action(
                    (value: string) => (this.props.format = parseInt(value))
                )}
            >
                <option value={WaveformFormat.UNKNOWN.toString()}>
                    Unknown
                </option>
                <option value={WaveformFormat.FLOATS_32BIT.toString()}>
                    32-bit float
                </option>
                <option value={WaveformFormat.FLOATS_64BIT.toString()}>
                    64-bit float
                </option>
                <option value={WaveformFormat.RIGOL_BYTE.toString()}>
                    Byte (Rigol)
                </option>
                <option value={WaveformFormat.RIGOL_WORD.toString()}>
                    Word (Rigol)
                </option>
                <option value={WaveformFormat.CSV_STRING.toString()}>
                    CSV
                </option>
            </SelectProperty>,
            <SelectProperty
                key="unit"
                name="Unit"
                value={this.props.unit.name}
                onChange={action(
                    (value: keyof typeof UNITS) =>
                        (this.props.unit = UNITS[value])
                )}
            >
                {this.units.map(unit => (
                    <option key={unit.name} value={unit.name}>
                        {capitalize(unit.name)}
                    </option>
                ))}
            </SelectProperty>,
            <TextInputProperty
                key="offset"
                name="Offset"
                value={this.props.offset}
                onChange={action(
                    (value: string) => (this.props.offset = value)
                )}
                errors={this.validator.errors.offset}
            />,
            <TextInputProperty
                key="scale"
                name="Scale"
                value={this.props.scale}
                onChange={action((value: string) => (this.props.scale = value))}
                errors={this.validator.errors.scale}
            />
        ];
    }
}
