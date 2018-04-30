import { observable, action, keys } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";

import { UIStateStore } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

interface DebugOptions {
    showPageTransparentRectangles: boolean;
}

let DEBUG_OPTIONS = {
    showPageTransparentRectangles: false
};

let options: DebugOptions = observable(Object.assign({}, DEBUG_OPTIONS));

let toggleShowPageTransparentRectangles = action(function(ev: any) {
    options.showPageTransparentRectangles = !options.showPageTransparentRectangles;
});

////////////////////////////////////////////////////////////////////////////////

export function getDebugOptions() {
    return UIStateStore.viewOptions.debugVisible ? options : DEBUG_OPTIONS;
}

////////////////////////////////////////////////////////////////////////////////

var debugVars = observable(new Map<string, any>());

export let setDebugVar = action((name: string, value: any) => {
    debugVars.set(name, value);
});

export let clearVars = action(() => {
    debugVars.clear();
});

////////////////////////////////////////////////////////////////////////////////

@observer
class Options extends React.Component<{}, {}> {
    render() {
        return (
            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={options.showPageTransparentRectangles}
                        onChange={toggleShowPageTransparentRectangles}
                    />{" "}
                    Show transparent rectangles inside pages
                </label>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Vars extends React.Component<{}, {}> {
    render() {
        let rows = keys(debugVars).map(name => (
            <tr key={name}>
                <td>{name}</td>
                <td>{debugVars.get(name)}</td>
            </tr>
        ));

        return (
            <table className="EezStudio_ProjectEditor_debug__vars">
                <thead>
                    <tr>
                        <td>Name</td>
                        <td>Value</td>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Debug extends React.Component<{}, {}> {
    render() {
        return (
            <div className="EezStudio_ProjectEditor_debug layoutCenter">
                <ul className="nav nav-pills layoutTop">
                    <li className="active">
                        <a href="#EezStudio_ProjectEditor_debug__options" data-toggle="tab">
                            Options
                        </a>
                    </li>
                    <li>
                        <a href="#EezStudio_ProjectEditor_debug__vars" data-toggle="tab">
                            Vars
                        </a>
                    </li>
                </ul>

                <div className="tab-content clearfix layoutCenter">
                    <div
                        className="tab-pane layoutCenter active"
                        id="EezStudio_ProjectEditor_debug__options"
                    >
                        <Options />
                    </div>
                    <div className="tab-pane layoutCenter" id="EezStudio_ProjectEditor_debug__vars">
                        <Vars />
                    </div>
                </div>
            </div>
        );
    }
}
