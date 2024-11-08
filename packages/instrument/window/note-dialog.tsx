import React from "react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { PropertyList, RichTextProperty } from "eez-studio-ui/properties";

class NoteDialog extends React.Component<{
    note?: string;
    callback: (note: string) => void;
}> {
    constructor(props: any) {
        super(props);

        this.note = this.props.note || "";
    }

    note: string;

    handleChange = (value: string) => {
        this.note = value;
    };

    handleSubmit = () => {
        this.props.callback(this.note);
        return true;
    };

    render() {
        return (
            <Dialog
                title="Add Note"
                size="large"
                modal={true}
                onOk={this.handleSubmit}
            >
                <PropertyList>
                    <RichTextProperty
                        name="text"
                        value={this.props.note}
                        onChange={this.handleChange}
                    />
                </PropertyList>
            </Dialog>
        );
    }
}

export function showAddNoteDialog(callback: (note: string) => void) {
    showDialog(<NoteDialog callback={callback} />);
}

export function showEditNoteDialog(
    note: string,
    callback: (note: string) => void
) {
    showDialog(<NoteDialog callback={callback} note={note} />);
}
