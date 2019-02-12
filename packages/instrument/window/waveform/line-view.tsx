import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { ILineController, globalViewOptions } from "eez-studio-ui/chart/chart";

import {
    IWaveform,
    IWaveformRenderJobSpecification,
    renderWaveformPath
} from "eez-studio-ui/chart/render";

////////////////////////////////////////////////////////////////////////////////

interface IWaveformLineController extends ILineController {
    waveform: IWaveform;
}

interface WaveformLineViewProperties {
    waveformLineController: IWaveformLineController;
}

@observer
export class WaveformLineView extends React.Component<WaveformLineViewProperties, {}> {
    @observable waveformLineController = this.props.waveformLineController;

    nextJob: IWaveformRenderJobSpecification | undefined;
    canvas: HTMLCanvasElement | null;
    continuation: any;
    requestAnimationFrameId: any;

    @computed
    get waveformRenderJobSpecification(): IWaveformRenderJobSpecification | undefined {
        const yAxisController = this.waveformLineController.yAxisController;
        const chartsController = yAxisController.chartsController;
        const xAxisController = chartsController.xAxisController;
        const waveform = this.waveformLineController.waveform;

        if (chartsController.chartWidth < 1 || !waveform.length) {
            return undefined;
        }

        return {
            renderAlgorithm: globalViewOptions.renderAlgorithm,
            waveform,
            xAxisController,
            yAxisController,
            xFromValue: xAxisController.from,
            xToValue: xAxisController.to,
            yFromValue: yAxisController.from,
            yToValue: yAxisController.to,
            strokeColor: globalViewOptions.blackBackground
                ? yAxisController.axisModel.color
                : yAxisController.axisModel.colorInverse
        };
    }

    @action
    componentWillReceiveProps(nextProps: WaveformLineViewProperties) {
        this.waveformLineController = nextProps.waveformLineController;
    }

    componentDidMount() {
        if (this.canvas) {
            this.draw();
        }
    }

    componentDidUpdate() {
        if (this.canvas) {
            this.draw();
        }
    }

    @bind
    drawStep() {
        this.continuation = renderWaveformPath(this.canvas!, this.nextJob!, this.continuation);
        if (this.continuation) {
            this.requestAnimationFrameId = window.requestAnimationFrame(this.drawStep);
        } else {
            this.requestAnimationFrameId = undefined;
        }
    }

    draw() {
        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
            this.requestAnimationFrameId = undefined;
        }
        if (this.nextJob) {
            this.continuation = undefined;
            this.drawStep();
        }
    }

    componentWillUnmount() {
        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }
    }

    render() {
        this.nextJob = this.waveformRenderJobSpecification;
        if (!this.nextJob) {
            return null;
        }

        const chartsController = this.props.waveformLineController.yAxisController.chartsController;

        return (
            <foreignObject x={chartsController.chartLeft} y={chartsController.chartTop}>
                <canvas
                    ref={ref => (this.canvas = ref)}
                    width={chartsController.chartWidth}
                    height={chartsController.chartHeight}
                    style={{ pointerEvents: "none" }}
                />
            </foreignObject>
        );
    }
}
