import * as React from "react";
import { observable, computed, action, runInAction } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { humanize } from "shared/string";

import { IExtension } from "shared/extensions/extension";
import {
    installedExtensions,
    installExtension,
    uninstallExtension,
    changeExtensionImage,
    exportExtension
} from "shared/extensions/extensions";

import { copyFile, getTempFilePath, getValidFileNameFromFileName } from "shared/util";
import { stringCompare } from "shared/string";
import { Splitter } from "shared/ui/splitter";
import { VerticalHeaderWithBody, Header, ToolbarHeader, Body } from "shared/ui/header-with-body";
import { Toolbar } from "shared/ui/toolbar";
import { ButtonAction } from "shared/ui/action";
import { List, ListItem } from "shared/ui/list";
import { confirm, confirmWithButtons, info } from "shared/ui/dialog";
import * as notification from "shared/ui/notification";

import { ExtensionShortcuts } from "home/extensions-manager/extension-shortcuts";

let selectedExtension = observable.box<IExtension>();

@observer
export class ExtensionInMasterView extends React.Component<
    {
        extension: IExtension;
    },
    {}
> {
    render() {
        return (
            <ListItem
                leftIcon={this.props.extension.image}
                leftIconSize={64}
                label={
                    <div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "space-between"
                            }}
                        >
                            <h5 className="EezStudio_NoWrap" style={{ marginBottom: 0 }}>
                                {this.props.extension.name}
                            </h5>
                            <small>{this.props.extension.version}</small>
                        </div>
                        <div>{this.props.extension.description}</div>
                        <div className="EezStudio_NoWrap">
                            <small>{this.props.extension.author}</small>
                        </div>
                    </div>
                }
            />
        );
    }
}

function confirmMessage(extension: IExtension) {
    return `You are about to install version ${extension.version} of the '${
        extension.name
    }' extension.`;
}

const BUTTON_INSTRUCTIONS = `
Click 'OK' to replace the installed version.
Click 'Cancel' to stop the installation.`;

const BUTTONS = ["OK", "Cancel"];

@observer
class MasterView extends React.Component<
    {
        selectedExtension: IExtension | undefined;
        selectExtension: (extension: IExtension) => void;
    },
    {}
> {
    @computed
    get sortedInstalledExtensions() {
        return installedExtensions
            .get()
            .sort((a, b) => stringCompare(a.name, b.name))
            .map(extension => ({
                id: extension.id,
                data: extension,
                selected:
                    this.props.selectedExtension !== undefined &&
                    extension.id === this.props.selectedExtension.id
            }));
    }

    installExtension() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            {
                properties: ["openFile"],
                filters: [
                    { name: "Extensions", extensions: ["zip"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            },
            async function(filePaths) {
                if (filePaths && filePaths[0]) {
                    try {
                        let filePath = filePaths[0];

                        const extension = await installExtension(filePath, {
                            notFound() {
                                info("This is not a valid extension package file.", undefined);
                            },
                            async confirmReplaceNewerVersion(
                                newExtension: IExtension,
                                existingExtension: IExtension
                            ) {
                                return (
                                    (await confirmWithButtons(
                                        confirmMessage(newExtension),
                                        `The newer version ${
                                            existingExtension.version
                                        } is already installed.${BUTTON_INSTRUCTIONS}`,
                                        BUTTONS
                                    )) === 0
                                );
                            },
                            async confirmReplaceOlderVersion(
                                newExtension: IExtension,
                                existingExtension: IExtension
                            ) {
                                return (
                                    (await confirmWithButtons(
                                        confirmMessage(newExtension),
                                        `The older version ${
                                            existingExtension.version
                                        } is already installed.${BUTTON_INSTRUCTIONS}`,
                                        BUTTONS
                                    )) === 0
                                );
                            },
                            async confirmReplaceTheSameVersion(
                                newExtension: IExtension,
                                existingExtension: IExtension
                            ) {
                                return (
                                    (await confirmWithButtons(
                                        confirmMessage(newExtension),
                                        `That version is already installed.${BUTTON_INSTRUCTIONS}`,
                                        BUTTONS
                                    )) === 0
                                );
                            }
                        });

                        if (extension) {
                            action(() => selectedExtension.set(extension))();
                            notification.success(`Extension "${extension.name}" installed`);
                        }
                    } catch (err) {
                        notification.error(err.toString());
                    }
                }
            }
        );
    }

    render() {
        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <ButtonAction
                        text="Install Extension"
                        title="Install extension"
                        className="btn-success"
                        onClick={this.installExtension}
                    />
                </ToolbarHeader>
                <Body tabIndex={0}>
                    <List
                        nodes={this.sortedInstalledExtensions}
                        renderNode={node => <ExtensionInMasterView extension={node.data} />}
                        selectNode={node => this.props.selectExtension(node.data)}
                    />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

type SectionType = "properties" | "shortcuts";

interface ExtensionSectionsProps {
    extension: IExtension;
}

@observer
export class ExtensionSections extends React.Component<ExtensionSectionsProps, {}> {
    @observable activeSection: SectionType = "properties";
    @observable propertiesComponent: JSX.Element | undefined;

    constructor(props: ExtensionSectionsProps) {
        super(props);

        this.renderPropertiesComponent(this.props.extension);
    }

    renderPropertiesComponent(extension: IExtension) {
        if (extension.renderPropertiesComponent) {
            extension
                .renderPropertiesComponent()
                .then(propertiesComponent =>
                    runInAction(() => (this.propertiesComponent = propertiesComponent))
                );
        } else {
            runInAction(() => {
                this.propertiesComponent = undefined;
            });
        }
    }

    componentWillReceiveProps(nextProps: ExtensionSectionsProps) {
        if (this.props.extension !== nextProps.extension) {
            this.renderPropertiesComponent(nextProps.extension);
        }
    }

    @action
    activateSection(section: SectionType, event: any) {
        event.preventDefault();
        this.activeSection = section;
    }

    render() {
        let availableSections: SectionType[] = [];

        if (this.propertiesComponent) {
            availableSections.push("properties");
        }

        if (this.props.extension.properties && this.props.extension.properties.shortcuts) {
            availableSections.push("shortcuts");
        }

        if (availableSections.length === 0) {
            return null;
        }

        let activeSection = this.activeSection;

        if (availableSections.indexOf(activeSection) === -1) {
            activeSection = availableSections[0];
        }

        let navigationItems = availableSections.map(section => {
            let className = classNames("nav-link", {
                active: section === activeSection
            });

            return (
                <li key={section} className="nav-item">
                    <a
                        className={className}
                        href="#"
                        onClick={this.activateSection.bind(this, section)}
                    >
                        {humanize(section)}
                    </a>
                </li>
            );
        });

        let body;
        if (activeSection === "properties") {
            body = this.propertiesComponent;
        } else if (activeSection === "shortcuts") {
            body = <ExtensionShortcuts extension={this.props.extension} />;
        }

        return (
            <div>
                <div style={{ marginTop: "10px" }}>
                    <ul className="nav nav-tabs">{navigationItems}</ul>
                </div>

                <div
                    style={{
                        padding: "10px"
                    }}
                >
                    {body}
                </div>
            </div>
        );
    }
}

@observer
export class DetailsView extends React.Component<{ extension: IExtension | undefined }, {}> {
    constructor(props: any) {
        super(props);

        this.handleUninstall = this.handleUninstall.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleChangeImage = this.handleChangeImage.bind(this);
    }

    handleUninstall() {
        confirm("Are you sure?", undefined, () => {
            uninstallExtension(this.props.extension!.id);
        });
    }

    handleExport() {
        EEZStudio.electron.remote.dialog.showSaveDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            {
                filters: [
                    { name: "Extension files", extensions: ["zip"] },
                    { name: "All Files", extensions: ["*"] }
                ],
                defaultPath: getValidFileNameFromFileName(this.props.extension!.name + ".zip")
            },
            async filePath => {
                if (filePath) {
                    try {
                        const tempFilePath = await getTempFilePath();
                        await exportExtension(this.props.extension!, tempFilePath);
                        await copyFile(tempFilePath, filePath);
                        notification.success(`Saved to "${filePath}"`);
                    } catch (err) {
                        notification.error(err.toString());
                    }
                }
            }
        );
    }

    handleChangeImage() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            {
                properties: ["openFile"],
                filters: [
                    { name: "Image files", extensions: ["png", "jpg", "jpeg"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            },
            filePaths => {
                if (filePaths && filePaths[0]) {
                    changeExtensionImage(this.props.extension!, filePaths[0]);
                }
            }
        );
    }

    render() {
        if (!this.props.extension) {
            return null;
        }

        return (
            <VerticalHeaderWithBody>
                <Header className="EezStudio_Extension_Details_Header">
                    <div className="EezStudio_Extension_Details_Header_ImageContainer">
                        <img src={this.props.extension.image} width={196} />
                        <a href="#" style={{ cursor: "pointer" }} onClick={this.handleChangeImage}>
                            Change image
                        </a>
                    </div>
                    <div className="EezStudio_Extension_Details_Header_Properties">
                        <div className="EezStudio_Extension_Details_Header_Properties_Name_And_Version">
                            <h5>{this.props.extension.name}</h5>
                            <div>Version {this.props.extension.version}</div>
                        </div>
                        <div>{this.props.extension.description}</div>
                        <div>{this.props.extension.author}</div>
                        <div style={{ marginBottom: "10px" }}>
                            <small>{this.props.extension.id}</small>
                        </div>
                        <Toolbar>
                            <ButtonAction
                                text="Uninstall"
                                title="Uninstall extension"
                                className="btn-danger"
                                onClick={this.handleUninstall}
                            />
                            {this.props.extension.isEditable &&
                                this.props.extension.isDirty && (
                                    <ButtonAction
                                        text="Export"
                                        title="Export extension"
                                        className="btn-secondary"
                                        onClick={this.handleExport}
                                    />
                                )}
                        </Toolbar>
                    </div>
                </Header>
                <Body>
                    <ExtensionSections extension={this.props.extension} />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

@observer
export class ExtensionsManager extends React.Component<{}, {}> {
    selectExtension(extension: IExtension) {
        selectedExtension.set(extension);
    }

    @computed
    get selectedExtension() {
        let extension = selectedExtension.get();
        if (installedExtensions.get().indexOf(extension) === -1) {
            return undefined;
        }
        return extension;
    }

    render() {
        return (
            <Splitter
                type="horizontal"
                sizes="240px|100%"
                persistId="home/extensions-manager/splitter"
            >
                <MasterView
                    selectedExtension={this.selectedExtension}
                    selectExtension={action((extension: IExtension) =>
                        selectedExtension.set(extension)
                    )}
                />
                <DetailsView extension={this.selectedExtension} />
            </Splitter>
        );
    }
}
