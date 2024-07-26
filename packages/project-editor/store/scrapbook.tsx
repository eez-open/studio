import React from "react";
import { IObservableValue, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";

import { showDialog } from "eez-studio-ui/dialog";

class ScrapbookManagerModel {
    activeScrapbook: string;

    constructor() {
        makeObservable(this, {
            activeScrapbook: observable
        });
    }
}

const model = new ScrapbookManagerModel();

const ScrapbookManagerDialog = observer(
    class ScrapbookManagerDialog extends React.Component<{
        modalDialog: IObservableValue<any>;
    }> {
        render() {
            console.log(model.activeScrapbook);
            return null;
        }
    }
);

export function showScrapbookManager() {
    const modalDialogObservable = observable.box<any>();

    const [modalDialog] = showDialog(
        <ScrapbookManagerDialog modalDialog={modalDialogObservable} />,
        {
            jsPanel: {
                id: "scrapbook-manager-dialog",
                title: "Scrapbook",
                width: 1280,
                height: 800
            }
        }
    );

    modalDialogObservable.set(modalDialog);
}
