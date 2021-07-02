import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import {
    ChartsView,
    globalViewOptions,
    ChartsController,
    ChartMode
} from "eez-studio-ui/chart/chart";

import { HistoryItemPreview } from "instrument/window/history/item-preview";

import { ChartsDisplayOption } from "instrument/window/lists/common-tools";
import { TableList } from "instrument/window/lists/table";
import { EnvelopeList } from "instrument/window/lists/envelope";

import { Waveform } from "instrument/window/waveform/generic";
import { MultiWaveform } from "instrument/window/waveform/multi";
import { DlogWaveform } from "instrument/window/waveform/dlog";

////////////////////////////////////////////////////////////////////////////////

export type ChartData =
    | EnvelopeList
    | TableList
    | Waveform
    | MultiWaveform
    | DlogWaveform;

export function createChartsController(
    chartData: ChartData,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
): ChartsController {
    if (
        chartData instanceof Waveform ||
        chartData instanceof MultiWaveform ||
        chartData instanceof DlogWaveform
    ) {
        return chartData.createChartsController(mode);
    }

    return chartData.createChartsController(displayOption, mode);
}

////////////////////////////////////////////////////////////////////////////////

interface ChartPreviewProps {
    data: ChartData;
}

@observer
export class ChartPreview extends React.Component<ChartPreviewProps, {}> {
    @observable zoom: boolean = false;

    @action.bound
    toggleZoom() {
        this.zoom = !this.zoom;
    }

    @computed
    get chartsController() {
        return createChartsController(
            this.props.data,
            "split",
            this.zoom ? "interactive" : "preview"
        );
    }

    render() {
        const className = classNames("EezStudio_ChartPreview", {
            EezStudio_ChartPreview_BlackBackground:
                globalViewOptions.blackBackground
        });

        let toolbarWhenZoomed;
        if (this.zoom) {
            if (
                this.props.data instanceof Waveform ||
                this.props.data instanceof MultiWaveform ||
                this.props.data instanceof DlogWaveform
            ) {
                toolbarWhenZoomed = this.props.data.renderToolbar(
                    this.chartsController
                );
            }
        }

        return (
            <HistoryItemPreview
                className={className}
                toolbarWhenZoomed={toolbarWhenZoomed}
                zoom={this.zoom}
                toggleZoom={this.toggleZoom}
                enableUnzoomWithEsc={false}
            >
                <ChartsView
                    chartsController={this.chartsController}
                    tabIndex={this.zoom ? 0 : undefined}
                />
            </HistoryItemPreview>
        );
    }
}
