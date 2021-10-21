import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { ChartMode } from "eez-studio-ui/chart/chart";
import { IChartsController, ChartsView } from "eez-studio-ui/chart/chart";
import { globalViewOptions } from "eez-studio-ui/chart/GlobalViewOptions";

import { HistoryItemPreview } from "instrument/window/history/item-preview";

import type { ChartsDisplayOption } from "instrument/window/lists/common-tools";

////////////////////////////////////////////////////////////////////////////////

export interface ChartData {
    isZoomable: boolean;
    renderToolbar: (chartsController: IChartsController) => React.ReactNode;
    createChartsController: (
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ) => IChartsController;
}

export function createChartsController(
    chartData: ChartData,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
): IChartsController {
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
        if (this.zoom || this.props.data.isZoomable) {
            toolbarWhenZoomed = this.props.data.renderToolbar(
                this.chartsController
            );
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
