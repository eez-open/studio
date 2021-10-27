import React from "react";
import { observer } from "mobx-react";

import { BootstrapDialog, showDialog } from "eez-studio-ui/dialog";

import { Setup, setupState } from "home/setup";
import { action, observable } from "mobx";

@observer
class AddInstrumentDialog extends React.Component<
    {
        callback: (instrumentId: string) => void;
    },
    {}
> {
    @observable open = true;

    @action.bound
    onAdd(instrumentId: string) {
        this.open = false;
        this.props.callback(instrumentId);
    }

    @action.bound
    onCancel() {
        this.open = false;
    }

    render() {
        return (
            <BootstrapDialog
                modal={true}
                open={this.open}
                size={"large"}
                onCancel={this.onCancel}
                disableButtons={true}
                okEnabled={() => false}
            >
                <Setup
                    onAddCallback={this.onAdd}
                    onCancelCallback={this.onCancel}
                />
            </BootstrapDialog>
        );
    }
}

export function showAddInstrumentDialog(
    callback: (instrumentId: string) => void
) {
    setupState.reset();
    showDialog(<AddInstrumentDialog callback={callback} />);
}
