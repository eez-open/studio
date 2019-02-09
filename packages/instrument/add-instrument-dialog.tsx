import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { IExtension } from "eez-studio-shared/extensions/extension";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { info } from "eez-studio-ui/dialog-electron";
import { PropertyList, SelectFromListProperty } from "eez-studio-ui/properties";
import { IListNode, ListItem } from "eez-studio-ui/list";

import { instrumentExtensions } from "instrument/instrument-extension";

@observer
class AddInstrumentDialog extends React.Component<
    {
        callback: (instrumentExtension: IExtension) => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.selectedInstrumentExtension = instrumentExtensions.get()[0];
    }

    @observable
    selectedInstrumentExtension: IExtension;

    renderNode(node: IListNode) {
        let instrumentExtension = node.data as IExtension;
        return (
            <ListItem
                leftIcon={instrumentExtension.image}
                leftIconSize={48}
                label={instrumentExtension.displayName || instrumentExtension.name}
            />
        );
    }

    @computed
    get instrumentExtensions() {
        return instrumentExtensions.get().map(instrumentExtension => ({
            id: instrumentExtension.id,
            data: instrumentExtension,
            selected: instrumentExtension.id === this.selectedInstrumentExtension.id
        }));
    }

    @action.bound
    selectInstrumentExtension(node: IListNode) {
        this.selectedInstrumentExtension = node.data;
    }

    @bind
    handleSubmit() {
        if (this.selectedInstrumentExtension) {
            this.props.callback(this.selectedInstrumentExtension);
            return true;
        }
        return false;
    }

    render() {
        return (
            <Dialog onOk={this.handleSubmit}>
                <PropertyList>
                    <SelectFromListProperty
                        name="Select instrument definition:"
                        nodes={this.instrumentExtensions}
                        renderNode={this.renderNode}
                        onChange={this.selectInstrumentExtension}
                    />
                </PropertyList>
            </Dialog>
        );
    }
}

export function showAddInstrumentDialog(callback: (instrumentExtension: IExtension) => void) {
    if (instrumentExtensions.get().length > 0) {
        showDialog(<AddInstrumentDialog callback={callback} />);
    } else {
        info(
            "There is no instrument installed.",
            "Go to the Extensions Manager and install some instrument."
        );
    }
}
