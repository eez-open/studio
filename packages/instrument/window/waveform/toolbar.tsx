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
                    </Toolbar>
                </React.Fragment>
            );
        }
    }
);
