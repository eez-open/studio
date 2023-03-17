import React from "react";
import { observer } from "mobx-react";

import { BootstrapDialog, showDialog } from "eez-studio-ui/dialog";

import { Setup, setupState, onAddInstrument } from "home/setup";
import { action, observable, makeObservable } from "mobx";

const AddInstrumentDialog = observer(
    class AddInstrumentDialog extends React.Component<{
        callback: (instrumentId: string) => void;
    }> {
        open = true;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                open: observable,
                onOk: action.bound,
                onCancel: action.bound
            });
        }

        onOk(instrumentId: string) {
            this.open = false;
            onAddInstrument(instrumentId => this.props.callback(instrumentId));
        }

        onCancel() {
            this.open = false;
        }

        render() {
            return (
                <BootstrapDialog
                    modal={true}
                    title="Add Instrument"
                    open={this.open}
                    size={"large"}
                    onCancel={this.onCancel}
                    disableButtons={false}
                    okEnabled={() => false}
                    backdrop="static"
                    buttons={[
                        {
                            id: "cancel",
                            type: "secondary",
                            position: "right",
                            onClick: this.onCancel,
                            disabled: false,
                            style: {},
                            text: "Cancel"
                        },
                        {
                            id: "ok",
                            type: "primary",
                            position: "right",
                            onClick: this.onOk,
                            disabled: false,
                            style: {},
                            text: "OK"
                        }
                    ]}
                >
                    <Setup onlyBody={true} />
                </BootstrapDialog>
            );
        }
    }
);

export function showAddInstrumentDialog(
    callback: (instrumentId: string) => void
) {
    setupState.reset();
    showDialog(<AddInstrumentDialog callback={callback} />);
}
