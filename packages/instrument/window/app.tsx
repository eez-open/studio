import React from "react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import {
    HorizontalHeaderWithBody,
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { Navigation } from "instrument/window/navigation";

import { ButtonAction, IconAction } from "eez-studio-ui/action";
import { AlertDanger } from "eez-studio-ui/alert";
import { Loader } from "eez-studio-ui/loader";
import { Toolbar } from "eez-studio-ui/toolbar";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { PropertyList, TextInputProperty } from "eez-studio-ui/properties";

import type { InstrumentAppStore } from "instrument/window/app-store";
import type { INavigationItem } from "instrument/window/navigation";
import type { InstrumentObject } from "instrument/instrument-object";
import { Icon } from "eez-studio-ui/icon";
import { settingsController } from "home/settings";

////////////////////////////////////////////////////////////////////////////////

export const EditInstrumentLabelDialog = observer(
    class EditInstrumentLabelDialog extends React.Component<{
        instrument: InstrumentObject;
        size?: "small" | "medium" | "large";
    }> {
        label: string;

        constructor(props: any) {
            super(props);

            this.label = this.props.instrument.label || "";

            makeObservable(this, {
                label: observable
            });
        }

        render() {
            return (
                <Dialog
                    onOk={() => {
                        this.props.instrument.setLabel(this.label.trim());
                        return true;
                    }}
                    size={this.props.size}
                >
                    <PropertyList>
                        <TextInputProperty
                            key="label"
                            name="Label"
                            value={this.label}
                            onChange={action(value => (this.label = value))}
                        />
                    </PropertyList>
                </Dialog>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const AppBar = observer(
    class AppBar extends React.Component<
        {
            appStore: InstrumentAppStore;
            selectedItem: INavigationItem | undefined;
        },
        {}
    > {
        get instrument() {
            return this.props.appStore.instrument;
        }

        handleConnectClick = () => {
            this.instrument.openConnectDialog();
        };

        handleDisconnectClick = () => {
            this.instrument.connection.disconnect();
        };

        onEditInstrumentLabel = () => {
            showDialog(
                <EditInstrumentLabelDialog
                    instrument={this.props.appStore.instrument}
                />
            );
        };

        render() {
            let recordHistoryButton = (
                <button
                    className={classNames(
                        "EezStudio_ConnectionBar_RecordHistoryButton btn btn-sm",
                        {
                            "btn-dark": settingsController.isDarkTheme,
                            "btn-light": !settingsController.isDarkTheme
                        }
                    )}
                    onClick={this.instrument.toggleRecordHistory}
                >
                    <Icon
                        icon={
                            this.instrument.recordHistory
                                ? "material:pause"
                                : "material:play_arrow"
                        }
                        style={{
                            color: this.instrument.recordHistory
                                ? "red"
                                : "green"
                        }}
                    />
                    {this.instrument.recordHistory
                        ? "Pause History Recording"
                        : "Resume History Recording"}
                </button>
            );

            let connectionStatus;
            if (this.instrument.connection.isIdle) {
                connectionStatus = (
                    <div>
                        <button
                            className="btn btn-success btn-sm"
                            onClick={this.handleConnectClick}
                        >
                            Connect
                        </button>
                        {recordHistoryButton}
                    </div>
                );
            } else if (this.instrument.connection.isConnected) {
                connectionStatus = (
                    <div>
                        <div>{this.instrument.connection.interfaceInfo}</div>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={this.handleDisconnectClick}
                        >
                            Disconnect
                        </button>
                        {recordHistoryButton}
                    </div>
                );
            } else {
                connectionStatus = (
                    <div>
                        <div style={{ display: "inline-block" }}>
                            <Loader size={25} />
                        </div>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={this.handleDisconnectClick}
                        >
                            Abort
                        </button>
                        {recordHistoryButton}
                    </div>
                );
            }

            let sendFile;
            if (
                this.instrument.sendFileToInstrumentHandler &&
                this.instrument.connection.isConnected
            ) {
                if (this.props.appStore.history.sendFileStatus) {
                    if (
                        this.props.appStore.navigationStore
                            .mainNavigationSelectedItem !=
                            this.props.appStore.navigationStore
                                .terminalNavigationItem &&
                        this.props.appStore.navigationStore
                            .mainNavigationSelectedItem !=
                            this.props.appStore.navigationStore
                                .startPageNavigationItem
                    ) {
                        sendFile = this.props.appStore.history.sendFileStatus;
                    }
                } else {
                    sendFile = (
                        <ButtonAction
                            icon="material:file_upload"
                            text="Send File"
                            onClick={
                                this.instrument.sendFileToInstrumentHandler
                            }
                            title="Send file to instrument"
                            className={"btn-primary"}
                        ></ButtonAction>
                    );
                }
            }

            let toolbarButtons =
                this.props.selectedItem &&
                this.props.selectedItem.renderToolbarButtons();

            return (
                <Header className="EezStudio_ConnectionBar">
                    <div>
                        <img src={this.instrument.image} draggable={false} />{" "}
                    </div>

                    <div>
                        <div>
                            <span>
                                [{this.instrument.id}] {this.instrument.name}
                            </span>
                            <IconAction
                                icon="material:edit"
                                onClick={this.onEditInstrumentLabel}
                                title="Edit Instrument Label"
                            ></IconAction>
                        </div>
                        {connectionStatus}
                    </div>

                    <div>{sendFile}</div>

                    <Toolbar className="EezStudio_InstrumentTools">
                        {toolbarButtons}
                    </Toolbar>
                </Header>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const App = observer(
    class App extends React.Component<{ appStore: InstrumentAppStore }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                appBar: computed
            });
        }

        renderedItems = new Set<string>();

        renderContent(item: INavigationItem) {
            this.renderedItems.add(item.id);
            return item.renderContent();
        }

        renderContentIfRenderedBefore(item: INavigationItem) {
            if (!this.renderedItems.has(item.id)) {
                return null;
            }
            return item.renderContent();
        }

        onSelectionChange = (item: INavigationItem) => {
            this.props.appStore.navigationStore.changeMainNavigationSelectedItem(
                item
            );
        };

        get appBar() {
            const instrument = this.props.appStore.instrument;
            if (!instrument) {
                return undefined;
            }

            return (
                <div>
                    {instrument.connection.error && (
                        <AlertDanger
                            className="mb-0"
                            onDismiss={() =>
                                instrument.connection.dismissError()
                            }
                        >
                            {instrument.connection.error}
                        </AlertDanger>
                    )}
                    {
                        <AppBar
                            appStore={this.props.appStore}
                            selectedItem={
                                this.props.appStore.navigationStore
                                    .mainNavigationSelectedItem
                            }
                        />
                    }
                </div>
            );
        }

        render() {
            const navigationItems =
                this.props.appStore.navigationStore.navigationItems;
            const selectedItem =
                this.props.appStore.navigationStore.mainNavigationSelectedItem;
            const appBar = this.appBar;

            return (
                <div className={"EezStudio_App"}>
                    <VerticalHeaderWithBody>
                        <Header>{appBar}</Header>
                        <Body>
                            <HorizontalHeaderWithBody>
                                <Header>
                                    <Navigation
                                        items={navigationItems}
                                        selectedItem={selectedItem}
                                        selectItem={this.onSelectionChange}
                                    />
                                </Header>
                                {navigationItems.map(item => (
                                    <Body
                                        visible={item === selectedItem}
                                        key={item.id}
                                    >
                                        {item === selectedItem
                                            ? this.renderContent(item)
                                            : this.renderContentIfRenderedBefore(
                                                  item
                                              )}
                                    </Body>
                                ))}
                            </HorizontalHeaderWithBody>
                        </Body>
                    </VerticalHeaderWithBody>
                </div>
            );
        }
    }
);
