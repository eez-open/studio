import React from "react";
import { observer } from "mobx-react";

import { BootstrapDialog, showDialog } from "eez-studio-ui/dialog";

import { Setup, setupState } from "home/setup";
import { action, observable, makeObservable } from "mobx";

const AddInstrumentDialog = observer(
    class AddInstrumentDialog extends React.Component<{
        callback: (instrumentId: string) => void;
        unmount: () => void;
    }> {
        open = true;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                open: observable,
                onAdd: action.bound,
                onCancel: action.bound
            });
        }

        onAdd(instrumentId: string) {
            this.open = false;
            this.props.callback(instrumentId);
        }

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
                    backdrop="static"
                    unmount={this.props.unmount}
                >
                    <Setup
                        onAddCallback={this.onAdd}
                        onCancelCallback={this.onCancel}
                    />
                </BootstrapDialog>
            );
        }
    }
);

export function showAddInstrumentDialog(
    callback: (instrumentId: string) => void
) {
    setupState.reset();
    const [, , root] = showDialog(
        <AddInstrumentDialog
            callback={callback}
            unmount={() => root.unmount()}
        />
    );
}
