import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    autorun,
    makeObservable,
    IReactionDisposer
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";

var sha256 = require("sha256");

import { compareVersions, studioVersion } from "eez-studio-shared/util";
import { humanize } from "eez-studio-shared/string";

import {
    ExtensionType,
    IExtension
} from "eez-studio-shared/extensions/extension";
import {
    extensions,
    installExtension,
    uninstallExtension,
    changeExtensionImage,
    exportExtension,
    reloadExtension
} from "eez-studio-shared/extensions/extensions";
import { extensionsFolderPath } from "eez-studio-shared/extensions/extension-folder";

import {
    copyFile,
    getTempFilePath,
    getValidFileNameFromFileName,
    writeBinaryData
} from "eez-studio-shared/util-electron";
import { stringCompare } from "eez-studio-shared/string";

import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";
import {
    ButtonAction,
    DropdownIconAction,
    DropdownItem
} from "eez-studio-ui/action";
import { List, ListItem, IListNode } from "eez-studio-ui/list";
import {
    info,
    confirm,
    confirmWithButtons
} from "eez-studio-ui/dialog-electron";
import * as notification from "eez-studio-ui/notification";
import { SearchInput } from "eez-studio-ui/search-input";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";

import { ExtensionShortcuts } from "home/extensions-manager/extension-shortcuts";
import { extensionsCatalog } from "home/extensions-manager/catalog";

import { homeLayoutModels } from "home/home-layout-models";

////////////////////////////////////////////////////////////////////////////////

const installedExtensions = computed(() => {
    return Array.from(extensions.values()).filter(
        extension => !extension.preInstalled
    );
});

////////////////////////////////////////////////////////////////////////////////

export enum ViewFilter {
    ALL,
    INSTALLED,
    NOT_INSTALLED,
    NEW_VERSIONS
}

interface IExtensionVersions {
    allVersions: IExtension[];
    installedVersion?: IExtension;
    latestVersion: IExtension;
    versionInFocus: IExtension; // installed || latest
}

class ExtensionsVersionsCatalogBuilder {
    extensionsVersions: IExtensionVersions[] = [];

    isInstalled(extension: IExtension) {
        return !!extension.installationFolderPath;
    }

    addVersion(extensionVersions: IExtensionVersions, extension: IExtension) {
        for (let i = 0; i < extensionVersions.allVersions.length; ++i) {
            const compareResult = compareVersions(
                extension.version,
                extensionVersions.allVersions[i].version
            );

            if (compareResult > 0) {
                extensionVersions.allVersions.splice(i, 0, extension);
                return;
            }

            if (compareResult === 0) {
                if (this.isInstalled(extension)) {
                    extensionVersions.allVersions[i] = extension;
                }
                return;
            }
        }

        extensionVersions.allVersions.push(extension);
    }

    addExtension(extension: IExtension) {
        for (const extensionVersions of this.extensionsVersions) {
            if (extensionVersions.versionInFocus.id === extension.id) {
                // a new version of already seen extension
                this.addVersion(extensionVersions, extension);

                if (
                    compareVersions(
                        extension.version,
                        extensionVersions.latestVersion.version
                    ) > 0
                ) {
                    extensionVersions.latestVersion = extension;
                }

                if (this.isInstalled(extension)) {
                    extensionVersions.installedVersion = extension;
                }

                extensionVersions.versionInFocus =
                    extensionVersions.installedVersion ||
                    extensionVersions.latestVersion;

                return;
            }
        }

        // a new extension
        const extensionVersions: IExtensionVersions = {
            allVersions: [extension],
            latestVersion: extension,
            versionInFocus: extension
        };

        if (this.isInstalled(extension)) {
            extensionVersions.installedVersion = extension;
        }

        this.extensionsVersions.push(extensionVersions);
    }

    get(
        extensionType?: ExtensionType,
        viewFilter?: ViewFilter,
        searchText?: string,
        excludeExtensions?: string[]
    ) {
        let extensionsVersions;

        if (extensionType) {
            extensionsVersions = this.extensionsVersions.filter(
                extensionsVersions =>
                    extensionsVersions.versionInFocus.extensionType ==
                    extensionType
            );
        } else {
            extensionsVersions = this.extensionsVersions;
        }

        if (searchText) {
            extensionsVersions = extensionsVersions.filter(
                extensionsVersions => {
                    const parts = searchText.trim().toLowerCase().split("+");
                    if (parts.length == 0) {
                        return true;
                    }

                    const searchTargets = [
                        extensionsVersions.versionInFocus.name,
                        extensionsVersions.versionInFocus.displayName,
                        extensionsVersions.versionInFocus.description,
                        extensionsVersions.versionInFocus.author
                    ]
                        .filter(target => target && target.trim().length > 0)
                        .join(", ")
                        .toLowerCase();

                    return !parts.find(
                        part => searchTargets.indexOf(part) == -1
                    );
                }
            );
        }

        if (excludeExtensions) {
            extensionsVersions = extensionsVersions.filter(
                extensionsVersions => {
                    return !excludeExtensions.find(
                        excludeExtension =>
                            extensionsVersions.versionInFocus.name ===
                            excludeExtension
                    );
                }
            );
        }

        if (viewFilter == undefined || viewFilter === ViewFilter.ALL) {
            return extensionsVersions;
        } else if (viewFilter === ViewFilter.INSTALLED) {
            return extensionsVersions.filter(
                extensionVersions => !!extensionVersions.installedVersion
            );
        } else if (viewFilter === ViewFilter.NOT_INSTALLED) {
            return extensionsVersions.filter(
                extensionVersions => !extensionVersions.installedVersion
            );
        } else {
            return extensionsVersions.filter(
                extensionVersions =>
                    extensionVersions.installedVersion &&
                    compareVersions(
                        extensionVersions.latestVersion.version,
                        extensionVersions.installedVersion.version
                    ) > 0
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ExtensionsManagerStore {
    section: ExtensionType = "iext";
    selectedExtension: IExtension | undefined;
    _viewFilter: ViewFilter | undefined;
    searchText: string = "";
    excludeExtensions: string[] | undefined;

    constructor() {
        makeObservable(this, {
            section: observable,
            selectedExtension: observable,
            _viewFilter: observable,
            viewFilter: computed,
            searchText: observable,
            excludeExtensions: observable,

            extensionsVersionsCatalogBuilder: computed,
            all: computed,
            installed: computed,
            notInstalled: computed,
            newVersions: computed,
            extensionNodes: computed,

            selectExtensionById: action,
            selectedExtensionVersions: computed,

            switchToInstrumentExtensions: action.bound,
            switchToProjectExtensions: action.bound,
            switchToMeasurementExtensions: action.bound,
            onSearchChange: action.bound
        });
    }

    updateSelectedExtension() {
        if (
            !extensionsManagerStore.extensionNodes.find(
                extensionNode => extensionNode.id == this.selectedExtension?.id
            )
        ) {
            this.selectedExtension =
                extensionsManagerStore.extensionNodes.length > 0
                    ? extensionsManagerStore.extensionNodes[0].data
                    : undefined;
        }
    }

    updateViewFilter() {
        if (this._viewFilter) {
            if (
                (this._viewFilter == ViewFilter.INSTALLED &&
                    this.installed.length == 0) ||
                (this._viewFilter == ViewFilter.NOT_INSTALLED &&
                    this.notInstalled.length == 0) ||
                (this._viewFilter == ViewFilter.NEW_VERSIONS &&
                    this.newVersions.length == 0)
            ) {
                this._viewFilter = ViewFilter.ALL;
            }
        }

        this.updateSelectedExtension();
    }

    switchToInstrumentExtensions() {
        this.section = "iext";
        this.updateViewFilter();
    }
    switchToProjectExtensions() {
        this.section = "pext";
        this.updateViewFilter();
    }
    switchToMeasurementExtensions() {
        this.section = "measurement-functions";
        this.updateViewFilter();
    }

    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
        this._viewFilter = ViewFilter.ALL;
    }

    get viewFilter() {
        if (this._viewFilter !== undefined) {
            return this._viewFilter;
        }

        if (this.newVersions.length > 0) {
            return ViewFilter.NEW_VERSIONS;
        }

        return ViewFilter.ALL;
    }

    set viewFilter(value: ViewFilter) {
        this._viewFilter = value;
    }

    filterExtension(extension: IExtension) {
        if (extension.extensionType != this.section) {
            return false;
        }
        return true;
    }

    get extensionsVersionsCatalogBuilder() {
        const builder = new ExtensionsVersionsCatalogBuilder();

        installedExtensions.get().forEach(extension => {
            builder.addExtension(extension);
        });

        extensionsCatalog.catalog.forEach((extension: any) => {
            const extensionMinStudioVersion = (extension as any)["eez-studio"]
                .minVersion;
            if (extensionMinStudioVersion !== undefined) {
                if (
                    compareVersions(studioVersion, extensionMinStudioVersion) <
                    0
                ) {
                    return;
                }
            }

            builder.addExtension(extension);
        });

        return builder;
    }

    get all() {
        return this.extensionsVersionsCatalogBuilder.get(
            this.section,
            ViewFilter.ALL,
            this.searchText
        );
    }

    get installed() {
        return this.extensionsVersionsCatalogBuilder.get(
            this.section,
            ViewFilter.INSTALLED,
            this.searchText
        );
    }

    get notInstalled() {
        return this.extensionsVersionsCatalogBuilder.get(
            this.section,
            ViewFilter.NOT_INSTALLED,
            this.searchText
        );
    }

    get newVersions() {
        return this.extensionsVersionsCatalogBuilder.get(
            this.section,
            ViewFilter.NEW_VERSIONS,
            this.searchText
        );
    }

    get newVersionsInAllSections() {
        return this.extensionsVersionsCatalogBuilder.get(
            undefined,
            ViewFilter.NEW_VERSIONS,
            ""
        );
    }

    get extensionNodes() {
        return this.extensionsVersionsCatalogBuilder
            .get(
                this.section,
                extensionsManagerStore.viewFilter,
                this.searchText,
                this.excludeExtensions
            )
            .sort((a, b) =>
                stringCompare(
                    a.versionInFocus.displayName || a.versionInFocus.name,
                    b.versionInFocus.displayName || b.versionInFocus.name
                )
            )
            .map(extension => ({
                id: extension.versionInFocus.id,
                data: extension.versionInFocus,
                selected:
                    extensionsManagerStore.selectedExtension !== undefined &&
                    extension.versionInFocus.id ===
                        extensionsManagerStore.selectedExtension.id
            }));
    }

    selectExtensionById(id: string) {
        const extensionNode = this.extensionNodes.find(
            extensionNode => extensionNode.id === id
        );
        this.selectedExtension =
            (extensionNode && extensionNode.data) || undefined;

        this.updateSelectedExtension();
    }

    getExtensionVersionsById(id: string) {
        return this.extensionsVersionsCatalogBuilder
            .get(undefined, ViewFilter.ALL, "")
            .find(
                extensionVersions => extensionVersions.versionInFocus.id === id
            );
    }

    get selectedExtensionVersions() {
        if (!this.selectedExtension) {
            return undefined;
        }
        return this.getExtensionVersionsById(this.selectedExtension.id);
    }

    getSelectedExtensionByVersion(version: string) {
        return (
            this.selectedExtensionVersions &&
            this.selectedExtensionVersions.allVersions.find(
                extension => extension.version === version
            )
        );
    }
}

export const extensionsManagerStore = new ExtensionsManagerStore();

////////////////////////////////////////////////////////////////////////////////

export const ExtensionInMasterView = observer(
    class ExtensionInMasterView extends React.Component<
        {
            extension: IExtension;
        },
        {}
    > {
        constructor(props: { extension: IExtension }) {
            super(props);

            makeObservable(this, {
                extensionInstalled: computed
            });
        }

        get extensionInstalled() {
            const extensionVersions =
                extensionsManagerStore.getExtensionVersionsById(
                    this.props.extension.id
                );
            return extensionVersions && extensionVersions.installedVersion;
        }

        render() {
            const badgeClassName = classNames("badge", {
                "bg-success": this.extensionInstalled,
                "bg-secondary": !this.extensionInstalled
            });

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
                                <h5
                                    className="EezStudio_NoWrap"
                                    style={{ marginBottom: 0 }}
                                >
                                    {this.props.extension.displayName ||
                                        this.props.extension.name}
                                    <span
                                        className={badgeClassName}
                                        style={{
                                            marginLeft: 10,
                                            fontSize: "70%"
                                        }}
                                    >
                                        <div>
                                            {this.extensionInstalled
                                                ? "Installed"
                                                : "Not installed"}
                                        </div>
                                    </span>
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
);

////////////////////////////////////////////////////////////////////////////////

function confirmMessage(extension: IExtension) {
    return `You are about to install version ${extension.version} of the '${
        extension.displayName || extension.name
    }' extension.`;
}

const BUTTON_INSTRUCTIONS = `
Click 'OK' to replace the installed version.
Click 'Cancel' to stop the installation.`;

const BUTTONS = ["OK", "Cancel"];

export const MasterView = observer(
    class MasterView extends React.Component {
        render() {
            return (
                <List
                    className="EezStudio_ExtensionsManager_MasterView"
                    nodes={extensionsManagerStore.extensionNodes}
                    renderNode={node => (
                        <ExtensionInMasterView extension={node.data} />
                    )}
                    selectNode={action(
                        (node: IListNode) =>
                            (extensionsManagerStore.selectedExtension =
                                node.data)
                    )}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

type SectionType = "properties" | "shortcuts";

interface ExtensionSectionsProps {
    extension: IExtension;
}

export const ExtensionSections = observer(
    class ExtensionSections extends React.Component<
        ExtensionSectionsProps,
        {}
    > {
        activeSection: SectionType = "properties";

        constructor(props: ExtensionSectionsProps) {
            super(props);

            makeObservable(this, {
                activeSection: observable,
                activateSection: action
            });
        }
        activateSection(section: SectionType, event: any) {
            event.preventDefault();
            this.activeSection = section;
        }

        render() {
            let availableSections: SectionType[] = [];

            const propertiesComponent = this.props.extension
                .renderPropertiesComponent
                ? this.props.extension.renderPropertiesComponent()
                : null;

            if (propertiesComponent) {
                availableSections.push("properties");
            }

            if (
                this.props.extension.properties &&
                this.props.extension.properties.shortcuts
            ) {
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
                body = propertiesComponent;
            } else if (activeSection === "shortcuts") {
                body = <ExtensionShortcuts extension={this.props.extension} />;
            }

            return (
                <div className="EezStudio_ExtensionsManager_DetailsView_Body">
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
);

////////////////////////////////////////////////////////////////////////////////

async function finishInstall(extensionZipPackageData: any) {
    const tempFilePath = await getTempFilePath();

    await writeBinaryData(tempFilePath, extensionZipPackageData);

    const extension = await installExtension(tempFilePath, {
        notFound() {},
        async confirmReplaceNewerVersion(
            newExtension: IExtension,
            existingExtension: IExtension
        ) {
            return true;
        },
        async confirmReplaceOlderVersion(
            newExtension: IExtension,
            existingExtension: IExtension
        ) {
            return true;
        },
        async confirmReplaceTheSameVersion(
            newExtension: IExtension,
            existingExtension: IExtension
        ) {
            return true;
        }
    });

    return extension;
}

export function downloadAndInstallExtension(
    extensionToInstall: IExtension,
    progressId: notification.ProgressId,
    progress: {
        update(
            progressId: string | number,
            options: {
                render: React.ReactNode;
                type: notification.Type;
                autoClose?: number | false;
            }
        ): void;
    } = notification
) {
    return new Promise<IExtension | undefined>(async (resolve, reject) => {
        if (extensionToInstall.extensionType == "pext") {
            progress.update(progressId, {
                render: `Installing extension ${
                    extensionToInstall.displayName || extensionToInstall.name
                }@${extensionToInstall.version} ...`,
                type: notification.INFO
            });

            try {
                const { yarnInstall } = await import(
                    "eez-studio-shared/extensions/yarn"
                );

                await yarnInstall(extensionToInstall);

                const extension = await reloadExtension(
                    extensionsFolderPath +
                        "/node_modules/" +
                        extensionToInstall.name
                );

                progress.update(progressId, {
                    render: `Extension ${
                        extensionToInstall.displayName ||
                        extensionToInstall.name
                    }@${extensionToInstall.version} has been installed.`,
                    type: notification.INFO,
                    autoClose: 5000
                });

                resolve(extension);
            } catch (err) {
                progress.update(progressId, {
                    render: `Failed to install ${
                        extensionToInstall.displayName ||
                        extensionToInstall.name
                    }@${extensionToInstall.version} extension: ${err}`,
                    type: notification.ERROR,
                    autoClose: 5000
                });

                reject();
            }
        } else {
            var req = new XMLHttpRequest();
            req.responseType = "arraybuffer";
            req.open("GET", extensionToInstall.download!);

            progress.update(progressId, {
                render: `Downloading "${
                    extensionToInstall.displayName || extensionToInstall.name
                }" extension package ...`,
                type: notification.INFO
            });

            req.addEventListener("progress", event => {
                progress.update(progressId, {
                    render: `Downloading "${
                        extensionToInstall.displayName ||
                        extensionToInstall.name
                    }" extension package: ${event.loaded} of ${event.total}.`,
                    type: notification.INFO
                });
            });

            req.addEventListener("load", () => {
                const extensionZipFileData = Buffer.from(req.response);

                if (extensionToInstall.sha256) {
                    if (
                        sha256(extensionZipFileData) !==
                        extensionToInstall.sha256
                    ) {
                        progress.update(progressId, {
                            render: `Failed to install "${
                                extensionToInstall.displayName ||
                                extensionToInstall.name
                            }" extension because package file hash doesn't match.`,
                            type: notification.ERROR,
                            autoClose: 5000
                        });
                        reject();
                        return;
                    }
                }

                finishInstall(extensionZipFileData)
                    .then(extension => {
                        if (extension) {
                            progress.update(progressId, {
                                render: `Extension "${
                                    extension.displayName || extension.name
                                }" installed.`,
                                type: notification.SUCCESS,
                                autoClose: 5000
                            });
                        } else {
                            progress.update(progressId, {
                                render: `Failed to install "${
                                    extensionToInstall.displayName ||
                                    extensionToInstall.name
                                }" extension.`,
                                type: notification.ERROR,
                                autoClose: 5000
                            });
                        }
                        resolve(extension);
                    })
                    .catch(error => {
                        console.error("Extension download error", error);
                        progress.update(progressId, {
                            render: `Failed to install "${
                                extensionToInstall.displayName ||
                                extensionToInstall.name
                            }" extension.`,
                            type: notification.ERROR,
                            autoClose: 5000
                        });
                        reject();
                    });
            });

            req.addEventListener("error", error => {
                console.error("Extension download error", error);
                progress.update(progressId, {
                    render: `Failed to download "${
                        extensionToInstall.displayName ||
                        extensionToInstall.name
                    }" extension package.`,
                    type: notification.ERROR,
                    autoClose: 5000
                });
                reject();
            });

            req.send();
        }
    });
}

////////////////////////////////////////////////////////////////////////////////

export const DetailsView = observer(
    class DetailsView extends React.Component {
        selectedVersion: string;
        autorunDispose: IReactionDisposer;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selectedVersion: observable,
                displayedExtension: computed,
                extensionVersions: computed,
                installEnabled: computed,
                updateEnabled: computed,
                replaceEnabled: computed,
                uninstallEnabled: computed
            });
        }

        componentDidMount() {
            this.autorunDispose = autorun(() => {
                const selectedExtensionVersions =
                    extensionsManagerStore.selectedExtensionVersions;
                if (selectedExtensionVersions) {
                    runInAction(
                        () =>
                            (this.selectedVersion =
                                selectedExtensionVersions.versionInFocus.version)
                    );
                }
            });
        }

        componentWillUnmount() {
            this.autorunDispose();
        }

        get displayedExtension() {
            return extensionsManagerStore.getSelectedExtensionByVersion(
                this.selectedVersion
            );
        }

        get extensionVersions() {
            return extensionsManagerStore.selectedExtensionVersions;
        }

        get installEnabled() {
            return !(
                this.extensionVersions &&
                this.extensionVersions.installedVersion
            );
        }

        get updateEnabled() {
            return (
                this.extensionVersions &&
                this.extensionVersions.installedVersion &&
                this.displayedExtension ===
                    this.extensionVersions.installedVersion &&
                compareVersions(
                    this.extensionVersions.latestVersion.version,
                    this.extensionVersions.installedVersion.version
                ) > 0
            );
        }

        get replaceEnabled() {
            return (
                this.extensionVersions &&
                this.extensionVersions.installedVersion &&
                this.displayedExtension !==
                    this.extensionVersions.installedVersion
            );
        }

        get uninstallEnabled() {
            return (
                this.extensionVersions &&
                this.extensionVersions.installedVersion
            );
        }

        handleInstall = async () => {
            if (!this.extensionVersions) {
                return;
            }

            let extensionToInstall = this.displayedExtension;
            if (!extensionToInstall) {
                return;
            }

            if (
                extensionToInstall === this.extensionVersions.installedVersion
            ) {
                // if already installed then install latest version
                extensionToInstall = this.extensionVersions.latestVersion;
                if (!extensionToInstall) {
                    return;
                }
            }

            const progressToastId = notification.info("Updating...", {
                autoClose: false
            });
            await new Promise(resolve => setTimeout(resolve, 500));

            const extension = await downloadAndInstallExtension(
                extensionToInstall,
                progressToastId
            );

            if (extension) {
                extensionsManagerStore.selectExtensionById(extension.id);
            }
        };

        handleUninstall = () => {
            if (!this.extensionVersions) {
                return;
            }

            const extension = this.extensionVersions.installedVersion;
            if (!extension) {
                return;
            }

            confirm("Are you sure?", undefined, async () => {
                try {
                    await uninstallExtension(extension.id);
                    notification.success(
                        `Extension "${
                            extension.displayName || extension.name
                        }" uninstalled`
                    );
                    extensionsManagerStore.selectExtensionById(extension.id);
                } catch (err) {
                    notification.error(
                        `Failed to uninstall extension ${
                            extension.displayName || extension.name
                        }: ${err}`
                    );
                }
            });
        };

        handleExport = async () => {
            if (!this.extensionVersions) {
                return;
            }

            const extension = this.extensionVersions.installedVersion;
            if (!extension) {
                return;
            }

            const result = await dialog.showSaveDialog(getCurrentWindow(), {
                filters: [
                    { name: "Extension files", extensions: ["zip"] },
                    { name: "All Files", extensions: ["*"] }
                ],
                defaultPath: getValidFileNameFromFileName(
                    extension.name + ".zip"
                )
            });

            let filePath = result.filePath;
            if (filePath) {
                if (!filePath.toLowerCase().endsWith(".zip")) {
                    filePath += ".zip";
                }

                try {
                    const tempFilePath = await getTempFilePath();
                    await exportExtension(extension, tempFilePath);
                    await copyFile(tempFilePath, filePath);
                    notification.success(`Saved to "${filePath}"`);
                } catch (err) {
                    notification.error(err.toString());
                }
            }
        };

        handleChangeImage = async () => {
            if (!this.extensionVersions) {
                return;
            }

            const extension = this.extensionVersions.installedVersion;
            if (!extension) {
                return;
            }

            const result = await dialog.showOpenDialog(getCurrentWindow(), {
                properties: ["openFile"],
                filters: [
                    {
                        name: "Image files",
                        extensions: ["png", "jpg", "jpeg"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ]
            });
            const filePaths = result.filePaths;
            if (filePaths && filePaths[0]) {
                changeExtensionImage(extension, filePaths[0]);
            }
        };

        static getFullDescription(extension: IExtension): React.ReactNode {
            let fullDescription;
            if (extension.moreDescription) {
                if (extension.description) {
                    fullDescription = extension.description.trim();
                    if (fullDescription) {
                        if (!fullDescription.endsWith(".")) {
                            fullDescription += ".";
                        }
                    }
                }

                if (extension.moreDescription) {
                    if (fullDescription) {
                        fullDescription += "\n";
                    }
                    fullDescription += extension.moreDescription.trim();
                    if (fullDescription) {
                        if (!fullDescription.endsWith(".")) {
                            fullDescription += ".";
                        }
                    }
                }
            } else {
                fullDescription = extension.description;
            }
            if (fullDescription) {
                fullDescription = <pre>{fullDescription}</pre>;
            }
            return fullDescription;
        }

        render() {
            const extension = this.displayedExtension;
            if (!extension) {
                return (
                    <div className="EezStudio_ExtensionsManager_DetailsView"></div>
                );
            }

            return (
                <VerticalHeaderWithBody className="EezStudio_ExtensionsManager_DetailsView">
                    <Header className="EezStudio_ExtensionDetailsHeader">
                        <div className="EezStudio_ExtensionDetailsHeaderImageContainer">
                            <img src={extension.image} width={256} />
                            {extension.installationFolderPath &&
                                extension.extensionType == "iext" && (
                                    <a
                                        href="#"
                                        style={{ cursor: "pointer" }}
                                        onClick={this.handleChangeImage}
                                    >
                                        Change image
                                    </a>
                                )}
                        </div>
                        <div className="EezStudio_ExtensionDetailsHeaderProperties">
                            <div className="EezStudio_ExtensionDetailsHeaderPropertiesNameAndVersion">
                                <h5>
                                    {extension.displayName || extension.name}
                                </h5>
                                <div className="form-inline">
                                    <label
                                        className="my-1 me-2"
                                        htmlFor="EezStudio_Extension_Details_VersionSelect"
                                    >
                                        Versions:
                                    </label>
                                    <select
                                        id="EezStudio_Extension_Details_VersionSelect"
                                        className="custom-select my-1 me-sm-2"
                                        value={this.selectedVersion}
                                        onChange={action(
                                            (
                                                event: React.ChangeEvent<HTMLSelectElement>
                                            ) => {
                                                this.selectedVersion =
                                                    event.currentTarget.value;
                                            }
                                        )}
                                    >
                                        {this.extensionVersions!.allVersions.map(
                                            extension => (
                                                <option
                                                    key={extension.version}
                                                    value={extension.version}
                                                >
                                                    {extension.version}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>
                            </div>
                            <div>
                                {DetailsView.getFullDescription(extension)}
                            </div>
                            <div>{extension.author}</div>
                            <div style={{ marginBottom: "10px" }}>
                                <small>{extension.id}</small>
                            </div>
                            <Toolbar>
                                {this.installEnabled && (
                                    <ButtonAction
                                        text="Install"
                                        title="Install extension"
                                        className="btn-success"
                                        onClick={this.handleInstall}
                                    />
                                )}
                                {this.updateEnabled && (
                                    <ButtonAction
                                        text="Update"
                                        title="Update extension to the latest version"
                                        className="btn-success"
                                        onClick={this.handleInstall}
                                    />
                                )}
                                {this.replaceEnabled && (
                                    <ButtonAction
                                        text="Replace"
                                        title="Replace installed extension with selected version"
                                        className="btn-success"
                                        onClick={this.handleInstall}
                                    />
                                )}
                                {this.uninstallEnabled && (
                                    <ButtonAction
                                        text="Uninstall"
                                        title="Uninstall extension"
                                        className="btn-danger"
                                        onClick={this.handleUninstall}
                                    />
                                )}
                                {extension.isEditable && extension.isDirty && (
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
                        <ExtensionSections extension={extension} />
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

const ExtensionsManagerSubNavigation = observer(
    class ExtensionsManagerSubNavigation extends React.Component {
        isUpdatingAll: boolean = false;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                isUpdatingAll: observable
            });
        }

        installExtensionFromFile = async () => {
            const result = await dialog.showOpenDialog(getCurrentWindow(), {
                properties: ["openFile"],
                filters: [
                    { name: "Extensions", extensions: ["zip"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            });

            const filePaths = result.filePaths;
            if (filePaths && filePaths[0]) {
                try {
                    let filePath = filePaths[0];

                    const extension = await installExtension(filePath, {
                        notFound() {
                            info(
                                "This is not a valid extension package file.",
                                undefined
                            );
                        },
                        async confirmReplaceNewerVersion(
                            newExtension: IExtension,
                            existingExtension: IExtension
                        ) {
                            return (
                                (await confirmWithButtons(
                                    confirmMessage(newExtension),
                                    `The newer version ${existingExtension.version} is already installed.${BUTTON_INSTRUCTIONS}`,
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
                                    `The older version ${existingExtension.version} is already installed.${BUTTON_INSTRUCTIONS}`,
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
                        notification.success(
                            `Extension "${
                                extension.displayName || extension.name
                            }" installed`
                        );

                        extensionsManagerStore.selectExtensionById(
                            extension.id
                        );
                    }
                } catch (err) {
                    notification.error(err.toString());
                }
            }
        };

        installExtensionFromFolder = async () => {
            const result = await dialog.showOpenDialog(getCurrentWindow(), {
                properties: ["openDirectory"]
            });

            if (result.filePaths && result.filePaths[0]) {
                const folderPath = result.filePaths[0];

                const progressToastId = notification.info("Updating...", {
                    autoClose: false
                });
                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    notification.update(progressToastId, {
                        render: `Installing extension from ${folderPath} ...`,
                        type: notification.INFO
                    });

                    const extensionToInstall = require(folderPath +
                        "/package.json");

                    const name = extensionToInstall.name;

                    extensionToInstall.name =
                        "link:" + folderPath.replace(/\\/g, "/");
                    extensionToInstall.version = undefined;

                    const { yarnInstall } = await import(
                        "eez-studio-shared/extensions/yarn"
                    );
                    await yarnInstall(extensionToInstall);

                    const extension = await reloadExtension(
                        extensionsFolderPath + "/node_modules/" + name
                    );

                    if (extension) {
                        extensionsManagerStore.selectExtensionById(
                            extension.id
                        );
                    }

                    notification.update(progressToastId, {
                        render: `Extension from ${folderPath} has been installed.`,
                        type: notification.INFO,
                        autoClose: 5000
                    });
                } catch (err) {
                    console.error(err);
                    notification.update(progressToastId, {
                        render: `Failed to install extension from ${folderPath}: ${err}`,
                        type: notification.ERROR,
                        autoClose: 5000
                    });
                }
            }
        };

        updateCatalog = async () => {
            await extensionsCatalog.checkNewVersionOfCatalog(true);
        };

        updateAll = async () => {
            runInAction(() => (this.isUpdatingAll = true));

            const extensionsToUpdate =
                extensionsManagerStore.extensionNodes.map(
                    extensionNode =>
                        extensionsManagerStore.getExtensionVersionsById(
                            extensionNode.data.id
                        )!.latestVersion
                );

            const progressToastId = notification.info("Updating...", {
                autoClose: false
            });
            await new Promise(resolve => setTimeout(resolve, 500));

            for (let i = 0; i < extensionsToUpdate.length; ++i) {
                await downloadAndInstallExtension(
                    extensionsToUpdate[i],
                    progressToastId
                );
            }

            notification.update(progressToastId, {
                render: "All extensions successfully updated!",
                type: notification.SUCCESS,
                autoClose: 5000
            });

            runInAction(() => (this.isUpdatingAll = false));
        };

        render() {
            return (
                <div className="EezStudio_ExtensionsManager_SubNavigation">
                    <div></div>

                    <div className="EezStudio_ExtensionsManager_ViewFilter">
                        <ul className="nav nav-pills">
                            <li
                                className="nav-item"
                                onClick={action(
                                    () =>
                                        (extensionsManagerStore.viewFilter =
                                            ViewFilter.ALL)
                                )}
                            >
                                <a
                                    href="#"
                                    className={classNames("nav-link", {
                                        active:
                                            extensionsManagerStore.viewFilter ===
                                            ViewFilter.ALL
                                    })}
                                >
                                    <Count
                                        label={"All"}
                                        count={
                                            extensionsManagerStore.all.length
                                        }
                                        attention={false}
                                    />
                                </a>
                            </li>
                            {extensionsManagerStore.installed.length > 0 && (
                                <li
                                    className="nav-item"
                                    onClick={action(
                                        () =>
                                            (extensionsManagerStore.viewFilter =
                                                ViewFilter.INSTALLED)
                                    )}
                                >
                                    <a
                                        href="#"
                                        className={classNames("nav-link", {
                                            active:
                                                extensionsManagerStore.viewFilter ===
                                                ViewFilter.INSTALLED
                                        })}
                                    >
                                        <Count
                                            label={"Installed"}
                                            count={
                                                extensionsManagerStore.installed
                                                    .length
                                            }
                                            attention={false}
                                        />
                                    </a>
                                </li>
                            )}
                            {extensionsManagerStore.notInstalled.length > 0 && (
                                <li
                                    className="nav-item"
                                    onClick={action(
                                        () =>
                                            (extensionsManagerStore.viewFilter =
                                                ViewFilter.NOT_INSTALLED)
                                    )}
                                >
                                    <a
                                        href="#"
                                        className={classNames("nav-link", {
                                            active:
                                                extensionsManagerStore.viewFilter ===
                                                ViewFilter.NOT_INSTALLED
                                        })}
                                    >
                                        <Count
                                            label={"Not installed"}
                                            count={
                                                extensionsManagerStore
                                                    .notInstalled.length
                                            }
                                            attention={false}
                                        />
                                    </a>
                                </li>
                            )}
                            {extensionsManagerStore.newVersions.length > 0 && (
                                <li
                                    className="nav-item"
                                    onClick={action(
                                        () =>
                                            (extensionsManagerStore.viewFilter =
                                                ViewFilter.NEW_VERSIONS)
                                    )}
                                >
                                    <a
                                        href="#"
                                        className={classNames("nav-link", {
                                            active:
                                                extensionsManagerStore.viewFilter ===
                                                ViewFilter.NEW_VERSIONS
                                        })}
                                    >
                                        <Count
                                            label={"New versions"}
                                            count={
                                                extensionsManagerStore
                                                    .newVersions.length
                                            }
                                            attention={
                                                extensionsManagerStore
                                                    .newVersions.length > 0
                                            }
                                        />
                                    </a>
                                </li>
                            )}
                        </ul>
                    </div>

                    <div>
                        {
                            <ButtonAction
                                text="Update All"
                                title=""
                                className="btn-success"
                                onClick={this.updateAll}
                                style={{
                                    visibility:
                                        extensionsManagerStore.viewFilter ===
                                            ViewFilter.NEW_VERSIONS &&
                                        extensionsManagerStore.extensionNodes
                                            .length > 0 &&
                                        !this.isUpdatingAll
                                            ? "visible"
                                            : "hidden"
                                }}
                            />
                        }
                        <DropdownIconAction
                            icon="material:menu"
                            title="Actions"
                        >
                            <DropdownItem
                                text="Update Catalog"
                                onClick={this.updateCatalog}
                            />
                            {(extensionsManagerStore.section == "iext" ||
                                extensionsManagerStore.section ==
                                    "measurement-functions") && (
                                <DropdownItem
                                    text="Install Extension"
                                    title="Install extension from local file"
                                    onClick={this.installExtensionFromFile}
                                />
                            )}
                            {extensionsManagerStore.section == "pext" && (
                                <DropdownItem
                                    text="Install Extension"
                                    title="Install extension from local folder"
                                    onClick={this.installExtensionFromFolder}
                                />
                            )}
                        </DropdownIconAction>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ExtensionsList = observer(
    class ExtensionsList extends React.Component {
        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "Master") {
                return <MasterView />;
            }

            if (component === "Details") {
                return <DetailsView />;
            }

            return null;
        };

        render() {
            if (extensionsManagerStore.extensionNodes.length === 0) {
                return (
                    <div className="EezStudio_ExtensionsManager_NoExtensions">
                        No extension found
                    </div>
                );
            }

            return (
                <FlexLayoutContainer
                    model={homeLayoutModels.extensionManager}
                    factory={this.factory}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ExtensionsManager = observer(
    class ExtensionsManager extends React.Component {
        render() {
            return (
                <div className="EezStudio_ExtensionsManager">
                    <SearchInput
                        searchText={extensionsManagerStore.searchText}
                        onClear={action(() => {
                            extensionsManagerStore.searchText = "";
                        })}
                        onChange={extensionsManagerStore.onSearchChange}
                    />

                    <div className="EezStudio_ExtensionsManager_Navigation">
                        <div
                            className={classNames(
                                "EezStudio_ExtensionsManager_NavigationItem",
                                {
                                    selected:
                                        extensionsManagerStore.section == "pext"
                                }
                            )}
                            onClick={
                                extensionsManagerStore.switchToProjectExtensions
                            }
                        >
                            <Count
                                label="Project Editor Extensions"
                                count={
                                    extensionsManagerStore.searchText
                                        ? extensionsManagerStore.extensionsVersionsCatalogBuilder.get(
                                              "pext",
                                              ViewFilter.ALL,
                                              extensionsManagerStore.searchText
                                          ).length
                                        : undefined
                                }
                                attention={
                                    extensionsManagerStore.extensionsVersionsCatalogBuilder.get(
                                        "pext",
                                        ViewFilter.NEW_VERSIONS,
                                        ""
                                    ).length > 0
                                }
                            />
                        </div>
                        <div
                            className={classNames(
                                "EezStudio_ExtensionsManager_NavigationItem",
                                {
                                    selected:
                                        extensionsManagerStore.section == "iext"
                                }
                            )}
                            onClick={
                                extensionsManagerStore.switchToInstrumentExtensions
                            }
                        >
                            <Count
                                label="Instrument Extensions"
                                count={
                                    extensionsManagerStore.searchText
                                        ? extensionsManagerStore.extensionsVersionsCatalogBuilder.get(
                                              "iext",
                                              ViewFilter.ALL,
                                              extensionsManagerStore.searchText
                                          ).length
                                        : undefined
                                }
                                attention={
                                    extensionsManagerStore.extensionsVersionsCatalogBuilder.get(
                                        "iext",
                                        ViewFilter.NEW_VERSIONS,
                                        ""
                                    ).length > 0
                                }
                            />
                        </div>
                        <div
                            className={classNames(
                                "EezStudio_ExtensionsManager_NavigationItem",
                                {
                                    selected:
                                        extensionsManagerStore.section ==
                                        "measurement-functions"
                                }
                            )}
                            onClick={
                                extensionsManagerStore.switchToMeasurementExtensions
                            }
                        >
                            <Count
                                label="Measurement Extensions"
                                count={
                                    extensionsManagerStore.searchText
                                        ? extensionsManagerStore.extensionsVersionsCatalogBuilder.get(
                                              "measurement-functions",
                                              ViewFilter.ALL,
                                              extensionsManagerStore.searchText
                                          ).length
                                        : undefined
                                }
                                attention={
                                    extensionsManagerStore.extensionsVersionsCatalogBuilder.get(
                                        "measurement-functions",
                                        ViewFilter.NEW_VERSIONS,
                                        ""
                                    ).length > 0
                                }
                            />
                        </div>
                    </div>

                    <div className="EezStudio_ExtensionsManager_Body">
                        {extensionsManagerStore.extensionsVersionsCatalogBuilder.get(
                            extensionsManagerStore.section,
                            ViewFilter.ALL,
                            extensionsManagerStore.searchText
                        ).length > 0 ? (
                            <>
                                <ExtensionsManagerSubNavigation />
                                <MasterView />
                                <DetailsView />
                            </>
                        ) : (
                            <div className="EezStudio_ExtensionsManager_NoExtensions">
                                No extension found
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Count = observer(
    ({
        label,
        count,
        attention
    }: {
        label: string;
        count: number | undefined;
        attention: boolean;
    }) => {
        const result = (
            <>
                {label}
                {count != undefined && (
                    <span
                        className={classNames(
                            "badge rounded-pill bg-secondary"
                        )}
                    >
                        {count}
                    </span>
                )}
            </>
        );

        if (attention) {
            return (
                <div className="EezStudio_AttentionContainer">
                    {result}
                    <div className="EezStudio_AttentionDiv" />
                </div>
            );
        }

        return result;
    }
);
