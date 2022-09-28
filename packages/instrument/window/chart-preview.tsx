import React from "react";
import { observable, computed, action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { ChartMode } from "eez-studio-ui/chart/chart";
import { IChartsController, ChartsView } from "eez-studio-ui/chart/chart";
import { globalViewOptions } from "eez-studio-ui/chart/GlobalViewOptions";

import { HistoryItemPreview } from "instrument/window/history/item-preview";

import type { ChartsDisplayOption } from "instrument/window/lists/common-tools";
import { IAppStore } from "instrument/window/history/history";

////////////////////////////////////////////////////////////////////////////////

export interface ChartData {
    isZoomable: boolean;
    renderToolbar: (chartsController: IChartsController) => React.ReactNode;
    createChartsController: (
        appStore: IAppStore,
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ) => IChartsController;
}

function createChartsController(
    appStore: IAppStore,
    chartData: ChartData,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
): IChartsController {
    return chartData.createChartsController(appStore, displayOption, mode);
}

////////////////////////////////////////////////////////////////////////////////

interface ChartPreviewProps {
    children?: React.ReactNode;
    appStore: IAppStore;
    data: ChartData;
}

export const ChartPreview = observer(
    class ChartPreview extends React.Component<ChartPreviewProps> {
        zoom: boolean = false;

        constructor(props: ChartPreviewProps) {
            super(props);

            makeObservable(this, {
                zoom: observable,
                toggleZoom: action.bound,
                chartsController: computed
            });
        }

        toggleZoom() {
            this.zoom = !this.zoom;
        }

        get chartsController() {
            return createChartsController(
                this.props.appStore,
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
);
