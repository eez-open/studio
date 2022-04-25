import React from "react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import type { Params } from "font-services/font-extract";
import type { Font } from "project-editor/features/font/font";
import { observer } from "mobx-react";
import { makeObservable } from "mobx";

export async function extractFontWithOpentype(data: Params) {
    return new Promise<Font>((resolve, reject) => {
        showDialog(<Progress onAbort={() => reject(false)} />);
    });
}

export const Progress = observer(
    class Progress extends React.Component<{ onAbort: () => void }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {});
        }

        render() {
            return (
                <Dialog cancelButtonText="Abort" onCancel={this.props.onAbort}>
                    TODO...
                </Dialog>
            );
        }
    }
);
