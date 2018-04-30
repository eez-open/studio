import * as React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { Loader } from "shared/ui/loader";
import { Toolbar } from "shared/ui/toolbar";

import { InstrumentObject } from "instrument/instrument-object";
import { getConnection } from "instrument/window/connection";
import { IInstrumentWindowNavigationItem } from "instrument/window/app";

@observer
export class AppBar extends React.Component<
    {
        instrument: InstrumentObject;
        selectedItem: IInstrumentWindowNavigationItem;
    },
    {}
> {
    get connection() {
        return getConnection(this.props.instrument);
    }

    @bind
    handleConnectClick() {
        this.connection.openConnectDialog();
    }

    @bind
    handleDisconnectClick() {
        this.props.instrument.connection.disconnect();
    }

    render() {
        let connectionStatus;
        if (this.props.instrument.connection.isIdle) {
            connectionStatus = (
                <div>
                    <button className="btn btn-success btn-sm" onClick={this.handleConnectClick}>
                        Connect
                    </button>
                </div>
            );
        } else if (this.props.instrument.connection.isConnected) {
            connectionStatus = (
                <div>
                    <div>{this.connection.interfaceInfo}</div>
                    <button className="btn btn-danger btn-sm" onClick={this.handleDisconnectClick}>
                        Disconnect
                    </button>
                </div>
            );
        } else {
            connectionStatus = (
                <div>
                    <div style={{ display: "inline-block" }}>
                        <Loader size={25} />
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={this.handleDisconnectClick}>
                        Abort
                    </button>
                </div>
            );
        }

        let toolbarButtons =
            this.props.selectedItem && this.props.selectedItem.renderToolbarButtons();

        return (
            <div className="EezStudio_ConnectionBar">
                <div>
                    <img src={this.props.instrument.image} draggable={false} />
                </div>

                <div>
                    <div>{this.props.instrument.name}</div>
                    {connectionStatus}
                </div>

                <Toolbar>{toolbarButtons}</Toolbar>
            </div>
        );
    }
}
