import { observable, computed, makeObservable } from "mobx";
import tinycolor from "tinycolor2";

import { capitalize } from "eez-studio-shared/string";
import { UNITS } from "eez-studio-shared/units";

import type { IAxisModel, ZoomMode } from "eez-studio-ui/chart/chart";
import type { IWaveformLink } from "instrument/window/waveform/multi";
import type { Waveform } from "./generic";

export const CONF_RANGE_OVERFLOW_PERCENT = 5;

export class WaveformAxisModel implements IAxisModel {
    constructor(
        private waveform: Waveform,
        private waveformLink: IWaveformLink | undefined
    ) {
        makeObservable(this, {
            minValue: computed,
            maxValue: computed,
            defaultFrom: computed,
            defaultTo: computed,
            unit: computed,
            dynamic: observable,
            fixed: observable
        });
    }

    get minValue() {
        return (
            this.waveform.minValue -
            (CONF_RANGE_OVERFLOW_PERCENT / 100) *
                (this.waveform.maxValue - this.waveform.minValue)
        );
    }

    get maxValue() {
        return (
            this.waveform.maxValue +
            (CONF_RANGE_OVERFLOW_PERCENT / 100) *
                (this.waveform.maxValue - this.waveform.minValue)
        );
    }

    get defaultFrom() {
        return this.minValue;
    }

    get defaultTo() {
        return this.maxValue;
    }

    get unit() {
        return UNITS[this.waveform.waveformDefinition.unitName];
    }

    dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "default",
        from: 0,
        to: 0
    };

    fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "default",
        subdivisionOffset: 0,
        subdivisonScale: 0
    };

    get defaultSubdivisionOffset(): number | undefined {
        return this.waveform.yAxisDefaultSubdivisionOffset;
    }

    get defaultSubdivisionScale() {
        return this.waveform.yAxisDefaultSubdivisionScale;
    }

    get label() {
        return (
            (this.waveformLink && this.waveformLink.label) ||
            this.waveform.waveformDefinition.label ||
            capitalize(this.unit.name)
        );
    }

    get color() {
        return (
            (this.waveformLink && this.waveformLink.color) ||
            this.waveform.waveformDefinition.color ||
            this.unit.color
        );
    }

    get colorInverse() {
        let color =
            (this.waveformLink && this.waveformLink.colorInverse) ||
            this.waveform.waveformDefinition.colorInverse;
        if (color) {
            return color;
        }

        color =
            (this.waveformLink && this.waveformLink.color) ||
            this.waveform.waveformDefinition.color;
        if (color) {
            // make color a little bit darker to look better on white background
            const c = tinycolor(color);
            const hsl = c.toHsl();
            hsl.l = hsl.l - 0.15;
            return tinycolor(hsl).toHexString();
        }

        return this.unit.colorInverse;
    }
}
