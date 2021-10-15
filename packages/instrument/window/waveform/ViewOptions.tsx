import { observable } from "mobx";

import type {
    IViewOptions,
    IViewOptionsAxesLines,
    IViewOptionsAxesLinesType
} from "eez-studio-ui/chart/chart";

////////////////////////////////////////////////////////////////////////////////

export class ViewOptions implements IViewOptions {
    constructor(props?: any) {
        if (props) {
            Object.assign(this, props);
        }
    }

    @observable axesLines: IViewOptionsAxesLines = {
        type: "dynamic",
        steps: {
            x: [],
            y: []
        },
        majorSubdivision: {
            horizontal: 24,
            vertical: 8
        },
        minorSubdivision: {
            horizontal: 5,
            vertical: 5
        },
        snapToGrid: true,
        defaultZoomMode: "default"
    };

    @observable showAxisLabels: boolean = true;
    @observable showZoomButtons: boolean = true;

    setAxesLinesType(type: IViewOptionsAxesLinesType) {
        this.axesLines.type = type;
    }

    setAxesLinesMajorSubdivisionHorizontal(value: number) {
        this.axesLines.majorSubdivision.horizontal = value;
    }

    setAxesLinesMajorSubdivisionVertical(value: number) {
        this.axesLines.majorSubdivision.vertical = value;
    }

    setAxesLinesMinorSubdivisionHorizontal(value: number) {
        this.axesLines.minorSubdivision.horizontal = value;
    }

    setAxesLinesMinorSubdivisionVertical(value: number) {
        this.axesLines.minorSubdivision.vertical = value;
    }

    setAxesLinesStepsX(steps: number[]) {
        this.axesLines.steps.x = steps;
    }

    setAxesLinesStepsY(index: number, steps: number[]): void {
        this.axesLines.steps.y[index] = steps;
    }

    setAxesLinesSnapToGrid(value: boolean): void {
        this.axesLines.snapToGrid = value;
    }

    setShowAxisLabels(value: boolean) {
        this.showAxisLabels = value;
    }

    setShowZoomButtons(value: boolean) {
        this.showZoomButtons = value;
    }
}
