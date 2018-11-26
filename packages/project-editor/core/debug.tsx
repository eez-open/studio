import { observable, action, keys } from "mobx";
import { observer } from "mobx-react";
import React from "react";

import styled from "eez-studio-ui/styled-components";

import { UIStateStore } from "eez-studio-shared/model/store";

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
            <table>
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

const DebugDiv = styled.div`
    flex-grow: 1;

    background-color: #333;
    border-color: 1px solid #999;
    color: white;

    #EezStudio_ProjectEditor_Debug_Vars {
        width: 100%;
    }

    .EezStudio_ProjectEditor_debug__vars td:nth-child(2) {
        padding-left: 10px;
        text-align: right;
    }
`;

const DebugVardDiv = styled.div`
    width: 100%;

    td:nth-child(2) {
        padding-left: 10px;
        text-align: right;
    }
`;

@observer
export class Debug extends React.Component<{}, {}> {
    render() {
        return (
            <DebugDiv>
                <ul className="nav nav-pills">
                    <li className="active">
                        <a href="#EezStudio_ProjectEditor_Debug_Options" data-toggle="tab">
                            Options
                        </a>
                    </li>
                    <li>
                        <a href="#EezStudio_ProjectEditor_Debug_Vars" data-toggle="tab">
                            Vars
                        </a>
                    </li>
                </ul>

                <div className="tab-content clearfix">
                    <div className="tab-pane active" id="EezStudio_ProjectEditor_Debug_Options">
                        <Options />
                    </div>
                    <DebugVardDiv className="tab-pane" id="EezStudio_ProjectEditor_Debug_Vars">
                        <Vars />
                    </DebugVardDiv>
                </div>
            </DebugDiv>
        );
    }
}
