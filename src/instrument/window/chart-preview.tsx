import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { Toolbar } from "shared/ui/toolbar";
import { IconAction } from "shared/ui/action";
import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { ChartsView, globalViewOptions } from "shared/ui/chart";

import { createChartsController, ChartData } from "instrument/window/chart-factory";
import { Waveform } from "instrument/window/waveform/generic";
import { MultiWaveform } from "instrument/window/waveform/multi";
import { DlogWaveform } from "instrument/window/waveform/dlog";

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

    render() {
        let className = classNames("EezStudio_HistoryItem_Charts", {
            zoom: this.zoom,
            EezStudio_HistoryItem_Charts_BlackBackground: globalViewOptions.blackBackground
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
                <VerticalHeaderWithBody className={className}>
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
                <div className={className} onClick={this.toggleZoom}>
                    <ChartsView chartsController={this.chartsController} />
                </div>
            );
        }
    }
}
