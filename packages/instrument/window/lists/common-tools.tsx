import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { ChartsController } from "eez-studio-ui/chart/chart";

////////////////////////////////////////////////////////////////////////////////

export const displayOption = observable.box<string>(
    localStorage.getItem("instrument/window/lists/displayOption") || "split"
);

export type ChartsDisplayOption = "split" | "voltage" | "current" | "both";

////////////////////////////////////////////////////////////////////////////////

@observer
export class CommonTools extends React.Component<{ chartsController: ChartsController }, {}> {
    @action
    onDisplayOptionChange(event: React.ChangeEvent<HTMLSelectElement>) {
        displayOption.set(event.target.value);
        localStorage.setItem("instrument/window/lists/displayOption", displayOption.get());
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
