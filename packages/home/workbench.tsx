import React from "react";
import { action, observable } from "mobx";
import { observer } from "mobx-react";

import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { Splitter } from "eez-studio-ui/splitter";
import styled from "eez-studio-ui/styled-components";
import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";

import * as AddInstrumentDialogModule from "instrument/add-instrument-dialog";
import * as DeletedInstrumentsDialogModule from "instrument/deleted-instruments-dialog";

import { HistorySection } from "home/history";

import classNames from "classnames";
import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { createInstrument } from "instrument/instrument-extension";

import { computed } from "mobx";

const { Menu, MenuItem } = EEZStudio.remote;

import {
    store,
    workbenchObjects,
    deleteWorkbenchObject,
    WorkbenchObject
} from "home/store";

////////////////////////////////////////////////////////////////////////////////

class WorkbenchDocument {
    @computed
    get objects() {
        return Array.from(workbenchObjects.values());
    }

    deleteObjects(objects: WorkbenchObject[]) {
        if (objects.length > 0) {
            beginTransaction("Delete workbench items");
        } else {
            beginTransaction("Delete workbench item");
        }

        objects.forEach(object =>
            deleteWorkbenchObject(object as WorkbenchObject)
        );

        commitTransaction();
    }

    createObject(params: any) {
        return store.createObject(params);
    }

    createContextMenu(objects: WorkbenchObject[]): Electron.Menu {
        const menu = new Menu();

        if (objects.length === 1) {
            const object = objects[0];

            if (object.addToContextMenu) {
                object.addToContextMenu(menu);
            }

            if (menu.items.length > 0) {
                menu.append(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menu.append(
                new MenuItem({
                    label: "Open in Tab",
                    click: () => {
                        object.openEditor!("tab");
                    }
                })
            );

            menu.append(
                new MenuItem({
                    label: "Open in Window",
                    click: () => {
                        object.openEditor!("window");
                    }
                })
            );
        }

        if (objects.length > 0) {
            if (menu.items.length > 0) {
                menu.append(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menu.append(
                new MenuItem({
                    label: "Delete",
                    click: () => {
                        this.deleteObjects(objects);
                    }
                })
            );
        }

        return menu;
    }
}

export const workbenchDocument = new WorkbenchDocument();

////////////////////////////////////////////////////////////////////////////////

@observer
export class WorkbenchToolbar extends React.Component {
    get buttons() {
        let buttons = [
            {
                id: "instrument-add",
                label: "Add Instrument",
                title: "Add instrument",
                className: "btn-success",
                onClick: () => {
                    const { showAddInstrumentDialog } =
                        require("instrument/add-instrument-dialog") as typeof AddInstrumentDialogModule;

                    showAddInstrumentDialog(extension => {
                        beginTransaction("Add instrument");
                        let params = createInstrument(extension);
                        workbenchDocument.createObject(params);
                        commitTransaction();
                    });
                }
            }
        ];

        const { showDeletedInstrumentsDialog, deletedInstruments } =
            require("instrument/deleted-instruments-dialog") as typeof DeletedInstrumentsDialogModule;

        if (deletedInstruments.size > 0) {
            buttons.push({
                id: "show-deleted-instruments",
                label: "Deleted Instruments",
                title: "Show deleted instruments",
                className: "btn-default",
                onClick: () => {
                    showDeletedInstrumentsDialog();
                }
            });
        }

        return buttons;
    }

    render() {
        return (
            <Toolbar className="EezStudio_ToolbarHeader">
                {this.buttons.map(button => (
                    <ButtonAction
                        key={button.id}
                        text={button.label}
                        title={button.title}
                        className={button.className}
                        onClick={button.onClick}
                    />
                ))}
            </Toolbar>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const HistoryContainerDiv = styled.div`
    display: flex;
    flex-direction: column;
    background-color: ${props => props.theme.panelHeaderColor};
    height: 100%;
`;

const HistoryContentDiv = styled.div`
    display: flex;
    flex-direction: row;
    flex-grow: 1;
    background-color: white;
    overflow: auto;
`;

const PanelTitleDiv = styled.div`
    display: flex;
    flex-direction: row;
    padding: 5px 10px;
    border-bottom: 1px solid ${props => props.theme.borderColor};
    font-weight: bold;
`;

const ObjectDetailsEnclosure = styled.div`
    background-color: ${props => props.theme.panelHeaderColor};
    min-height: 100%;
`;

export class PanelTitle extends React.Component<{ title?: string }, {}> {
    render() {
        return <PanelTitleDiv>{this.props.title}</PanelTitleDiv>;
    }
}

@observer
export class Properties extends React.Component<{
    selectedObject: WorkbenchObject | undefined;
}> {
    render() {
        if (!this.props.selectedObject) {
            return <div />;
        }

        let history = (
            <HistoryContainerDiv>
                <PanelTitle title="History" />
                <HistoryContentDiv>
                    <HistorySection
                        oids={[this.props.selectedObject.oid]}
                        simple={true}
                    />
                </HistoryContentDiv>
            </HistoryContainerDiv>
        );

        return (
            <Splitter
                type="vertical"
                sizes={"100%|240px"}
                persistId={"home/designer/properties/splitter"}
            >
                <ObjectDetailsEnclosure>
                    {this.props.selectedObject.details}
                </ObjectDetailsEnclosure>
                {history}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ObjectComponentDiv = styled.div`
    width: 240px;

    &.selected {
        background-color: ${props =>
            props.theme.selectionBackgroundColor}!important;
        color: ${props => props.theme.selectionColor};
    }
`;

@observer
class ObjectComponent extends React.Component<
    {
        object: WorkbenchObject;
        isSelected: boolean;
        selectObject: (object: WorkbenchObject) => void;
    },
    {}
> {
    render() {
        const { object } = this.props;
        return (
            <ObjectComponentDiv
                className={classNames("shadow p-3 m-3 bg-body rounded", {
                    selected: this.props.isSelected
                })}
                onClick={() => this.props.selectObject(object)}
                onDoubleClick={() => this.props.object.open()}
            >
                {object.content}
            </ObjectComponentDiv>
        );
    }
}

const WorkbenchDocumentDiv = styled.div`
    margin: 10px;
    min-height: calc(100% - 20px);
`;

@observer
export class WorkbenchDocumentComponent extends React.Component<{
    selectedObject: WorkbenchObject | undefined;
    selectObject: (object: WorkbenchObject) => void;
}> {
    selectObject = (object: WorkbenchObject) => {
        this.props.selectObject(object);
    };

    render() {
        return (
            <WorkbenchDocumentDiv className="d-flex flex-wrap justify-content-center align-items-center">
                {workbenchDocument.objects
                    .sort((a, b) => stringCompare(a.name, b.name))
                    .map(obj => (
                        <ObjectComponent
                            key={obj.id}
                            object={obj}
                            isSelected={obj == this.props.selectedObject}
                            selectObject={this.selectObject}
                        />
                    ))}
            </WorkbenchDocumentDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Workbench extends React.Component<{}, {}> {
    @observable selectedObject: WorkbenchObject | undefined;

    @action.bound
    selectObject(object: WorkbenchObject) {
        this.selectedObject = object;
    }

    render() {
        return (
            <VerticalHeaderWithBody>
                <Header>
                    <WorkbenchToolbar />
                </Header>
                <Body>
                    <Splitter
                        type="horizontal"
                        sizes={/*"240px|100%|240px"*/ "100%|240px"}
                        persistId="home/designer/splitter"
                    >
                        <WorkbenchDocumentComponent
                            selectedObject={this.selectedObject}
                            selectObject={this.selectObject}
                        />

                        <Properties selectedObject={this.selectedObject} />
                    </Splitter>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
