import React from "react";
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import type { IChartsController } from "eez-studio-ui/chart/chart";

////////////////////////////////////////////////////////////////////////////////

export const displayOption = observable.box<string>(
    localStorage.getItem("instrument/window/lists/displayOption") || "split"
);

export type ChartsDisplayOption = "split" | "voltage" | "current" | "both";

////////////////////////////////////////////////////////////////////////////////

export const CommonTools = observer(
    class CommonTools extends React.Component<
        { chartsController: IChartsController },
        {}
    > {
        constructor(props: { chartsController: IChartsController }) {
            super(props);

            makeObservable(this, {
                onDisplayOptionChange: action
            });
        }

        onDisplayOptionChange(event: React.ChangeEvent<HTMLSelectElement>) {
            displayOption.set(event.target.value);
            localStorage.setItem(
                "instrument/window/lists/displayOption",
                displayOption.get()
            );
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
                                        title="Zoom to view all list data"
                                        onClick={
                                            this.props.chartsController.zoomAll
                                        }
                                    >
                                        Zoom to Fit
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
);
