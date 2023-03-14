import React from "react";
import { observer } from "mobx-react";

import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";
import type { IChartsController } from "eez-studio-ui/chart/chart";

////////////////////////////////////////////////////////////////////////////////

interface IWaveform {
    openConfigurationDialog?: () => void;
}

export const WaveformToolbar = observer(
    class WaveformToolbar extends React.Component<
        {
            chartsController: IChartsController;
            waveform: IWaveform;
        },
        {}
    > {
        configureChart = () => {
            if (this.props.waveform.openConfigurationDialog) {
                this.props.waveform.openConfigurationDialog();
            }
        };

        render() {
            return (
                <React.Fragment>
                    <Toolbar>
                        {this.props.waveform.openConfigurationDialog && (
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
                            text="Zoom to Fit"
                            className="btn-secondary"
                            title="Zoom to Fit"
                            onClick={this.props.chartsController.zoomAll}
                        />
                        <ButtonAction
                            text="Zoom 100%"
                            className="btn-secondary"
                            title="Zoom 100% (1px per sample)"
                            onClick={this.props.chartsController.zoomDefault}
                        />
                    </Toolbar>
                </React.Fragment>
            );
        }
    }
);
