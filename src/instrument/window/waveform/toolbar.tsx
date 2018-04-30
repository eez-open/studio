import * as React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { Toolbar } from "shared/ui/toolbar";
import { ButtonAction } from "shared/ui/action";
import { ChartsController } from "shared/ui/chart";

import { ChartViewOptions, chartViewOptionsVisible } from "instrument/window/chart-view-options";

import { Waveform } from "instrument/window/waveform/generic";
import { MultiWaveform } from "instrument/window/waveform/multi";
import { DlogWaveform } from "instrument/window/waveform/dlog";

////////////////////////////////////////////////////////////////////////////////

@observer
export class WaveformToolbar extends React.Component<
    {
        chartsController: ChartsController;
        waveform: Waveform | MultiWaveform | DlogWaveform;
    },
    {}
> {
    @bind
    configureChart() {
        if (!(this.props.waveform instanceof DlogWaveform)) {
            this.props.waveform.openConfigurationDialog();
        }
    }

    @action.bound
    showViewOptions() {
        chartViewOptionsVisible.set(!chartViewOptionsVisible.get());
    }

    render() {
        return (
            <React.Fragment>
                <Toolbar>
                    {!(this.props.waveform instanceof DlogWaveform) && (
                        <ButtonAction
                            text="Configure"
                            className="btn-primary"
                            title="Configure chart"
                            onClick={this.configureChart}
                        />
                    )}
                </Toolbar>
                <Toolbar>
                    <ButtonAction
                        text="Zoom Default"
                        className="btn-secondary"
                        title="Reset zoom and offset to default values"
                        onClick={this.props.chartsController.zoomDefault}
                    />
                    <ButtonAction
                        text="Zoom All"
                        className="btn-secondary"
                        title="Zoom all"
                        onClick={this.props.chartsController.zoomAll}
                    />
                    <ButtonAction
                        text="View Options"
                        className="btn-secondary"
                        title="View options"
                        onClick={this.showViewOptions}
                    />
                </Toolbar>
                <ChartViewOptions
                    chartsController={this.props.chartsController}
                    showRenderAlgorithm={true}
                />
            </React.Fragment>
        );
    }
}
