import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { Toolbar } from "shared/ui/toolbar";
import { IconAction } from "shared/ui/action";
import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { ChartsView, globalViewOptions, ChartsController, ChartMode } from "shared/ui/chart/chart";

import { ChartsDisplayOption } from "instrument/window/lists/common-tools";
import { TableList } from "instrument/window/lists/table";
import { EnvelopeList } from "instrument/window/lists/envelope";

import { Waveform } from "instrument/window/waveform/generic";
import { MultiWaveform } from "instrument/window/waveform/multi";
import { DlogWaveform } from "instrument/window/waveform/dlog";

////////////////////////////////////////////////////////////////////////////////

export type ChartData = EnvelopeList | TableList | Waveform | MultiWaveform | DlogWaveform;

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
    @observable data: ChartData = this.props.data;
    @observable zoom: boolean = false;

    @action.bound
    toggleZoom() {
        this.zoom = !this.zoom;
    }

    @computed
    get chartsController() {
        return createChartsController(this.data, "split", this.zoom ? "interactive" : "preview");
    }

    @action
    componentWillReceiveProps(nextProps: ChartPreviewProps) {
        this.data = nextProps.data;
    }

    @bind
    onContextMenu(event: React.MouseEvent<HTMLDivElement>) {
        if (this.zoom) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    render() {
        let className = classNames("EezStudio_HistoryItem_Preview EezStudio_ChartPreview", {
            zoom: this.zoom,
            EezStudio_ChartPreview_BlackBackground: globalViewOptions.blackBackground
        });

        if (this.zoom) {
            let toolbar;
            if (
                this.props.data instanceof Waveform ||
                this.props.data instanceof MultiWaveform ||
                this.props.data instanceof DlogWaveform
            ) {
                toolbar = this.props.data.renderToolbar(this.chartsController);
            } else {
                toolbar = <Toolbar />;
            }

            return (
                <VerticalHeaderWithBody className={className} onContextMenu={this.onContextMenu}>
                    <Header>
                        {toolbar}
                        <Toolbar>
                            <IconAction
                                icon="material:close"
                                iconSize={24}
                                title="Leave full screen mode"
                                onClick={this.toggleZoom}
                            />
                        </Toolbar>
                    </Header>
                    <Body>
                        <ChartsView chartsController={this.chartsController} tabIndex={0} />
                    </Body>
                </VerticalHeaderWithBody>
            );
        } else {
            return (
                <div
                    className={className}
                    onClick={this.toggleZoom}
                    onContextMenu={this.onContextMenu}
                >
                    <ChartsView chartsController={this.chartsController} />
                </div>
            );
        }
    }
}
