import React from "react";
import { action, computed, observable } from "mobx";
import { observer } from "mobx-react";
import {
    IWaveformRenderJobSpecification,
    renderWaveformPath,
    ILineController,
    IWaveform
} from "./chart";
import { globalViewOptions } from "./GlobalViewOptions";

interface IWaveformLineController extends ILineController {
    waveform: IWaveform;
}

interface WaveformLineViewProperties {
    waveformLineController: IWaveformLineController;
    label?: string;
}

@observer
export class WaveformLineView extends React.Component<WaveformLineViewProperties> {
    @observable waveformLineController = this.props.waveformLineController;

    nextJob: IWaveformRenderJobSpecification | undefined;
    canvas: HTMLCanvasElement | undefined;
    @observable chartImage: string | undefined;
    continuation: any;
    requestAnimationFrameId: any;

    @computed
    get waveformRenderJobSpecification():
        | IWaveformRenderJobSpecification
        | undefined {
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
                : yAxisController.axisModel.colorInverse,
            label:
                yAxisController.chartController!.lineControllers.length > 1 &&
                chartsController.mode !== "preview"
                    ? this.props.label
                    : undefined
        };
    }

    @action
    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.waveformLineController = this.props.waveformLineController;
        }
        this.draw();
    }

    componentDidMount() {
        this.draw();
    }

    @action.bound
    drawStep() {
        if (!this.canvas) {
            const chartsController =
                this.props.waveformLineController.yAxisController
                    .chartsController;
            this.canvas = document.createElement("canvas");
            this.canvas.width = Math.floor(chartsController.chartWidth);
            this.canvas.height = Math.floor(chartsController.chartHeight);
        }

        this.continuation = renderWaveformPath(
            this.canvas,
            this.nextJob!,
            this.continuation
        );
        if (this.continuation) {
            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.drawStep
            );
        } else {
            this.requestAnimationFrameId = undefined;
            this.chartImage = this.canvas.toDataURL();
            this.canvas = undefined;
        }
    }

    draw() {
        if (this.nextJob != this.waveformRenderJobSpecification) {
            if (this.requestAnimationFrameId) {
                window.cancelAnimationFrame(this.requestAnimationFrameId);
                this.requestAnimationFrameId = undefined;
            }

            this.nextJob = this.waveformRenderJobSpecification;
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
        if (!this.waveformRenderJobSpecification) {
            return null;
        }
        const chartsController =
            this.props.waveformLineController.yAxisController.chartsController;

        return (
            <image
                x={Math.floor(chartsController.chartLeft)}
                y={Math.floor(chartsController.chartTop)}
                width={Math.floor(chartsController.chartWidth)}
                height={Math.floor(chartsController.chartHeight)}
                href={this.chartImage}
            />
        );
    }
}
