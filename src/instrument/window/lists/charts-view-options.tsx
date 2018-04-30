import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { ChartsController } from "shared/ui/chart";

import { ChartViewOptions, chartViewOptionsVisible } from "instrument/window/chart-view-options";
import { EnvelopeChartsController } from "instrument/window/lists/envelope";

////////////////////////////////////////////////////////////////////////////////

export const displayOption = observable.box<string>(
    localStorage.getItem("instrument/window/lists/displayOption") || "split"
);

export type ChartsDisplayOption = "split" | "voltage" | "current" | "both";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ChartsViewOptions extends React.Component<{ chartsController: ChartsController }, {}> {
    @action
    onDisplayOptionChange(event: React.ChangeEvent<HTMLSelectElement>) {
        displayOption.set(event.target.value);
        localStorage.setItem("instrument/window/lists/displayOption", displayOption.get());
    }

    @action.bound
    showViewOptions() {
        chartViewOptionsVisible.set(!chartViewOptionsVisible.get());
    }

    render() {
        return (
            <table>
                <tbody>
                    <tr>
                        {this.props.chartsController.isZoomAllEnabled && (
                            <td>
                                <button
                                    className="btn btn-secondary"
                                    title="Zoom All"
                                    onClick={this.props.chartsController.zoomAll}
                                >
                                    Zoom All
                                </button>
                            </td>
                        )}
                        <td>
                            <button
                                className="btn btn-secondary"
                                title="View options"
                                onClick={this.showViewOptions}
                            >
                                View Options
                            </button>
                            {chartViewOptionsVisible.get() && (
                                <ChartViewOptions
                                    chartsController={this.props.chartsController}
                                    showShowSampledDataOption={
                                        this.props.chartsController instanceof
                                        EnvelopeChartsController
                                    }
                                />
                            )}
                        </td>
                        <td>
                            <label>Display</label>
                        </td>
                        <td>
                            <label className="form-check-label">
                                <select
                                    className="form-control"
                                    value={displayOption.get()}
                                    onChange={this.onDisplayOptionChange}
                                >
                                    <option value="split">Split</option>
                                    <option value="voltage">Voltage</option>
                                    <option value="current">Current</option>
                                    <option value="both">Both</option>
                                </select>
                            </label>
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    }
}
