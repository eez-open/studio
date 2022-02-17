import { ipcRenderer } from "electron";
import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    toJS,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import moment from "moment";
import classNames from "classnames";

const shell = require("electron").shell;
import { app, createEmptyFile } from "eez-studio-shared/util-electron";
import { stringCompare } from "eez-studio-shared/string";
import { getDbPath, setDbPath } from "eez-studio-shared/db-path";
import {
    LOCALES,
    getLocale,
    setLocale,
    DATE_FORMATS,
    getDateFormat,
    setDateFormat,
    TIME_FORMATS,
    getTimeFormat,
    setTimeFormat
} from "eez-studio-shared/i10n";
import { formatBytes } from "eez-studio-shared/formatBytes";

import { showDialog, Dialog } from "eez-studio-ui/dialog";
import { Loader } from "eez-studio-ui/loader";

import {
    BooleanProperty,
    PropertyList,
    SelectProperty
} from "eez-studio-ui/properties";
import { FileInputProperty } from "eez-studio-ui/properties-electron";
import * as notification from "eez-studio-ui/notification";

import dbVacuum from "db-services/vacuum";
import { Header } from "eez-studio-ui/header-with-body";

////////////////////////////////////////////////////////////////////////////////

// after this period we should advise user to compact database
const CONF_DATABASE_COMPACT_ADVISE_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days

const TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME =
    "/home/settings/timeOfLastDatabaseCompactOperation";

export const COMPACT_DATABASE_MESSAGE =
    "It is advisable to compact database every 30 days.";

////////////////////////////////////////////////////////////////////////////////

const getIsDarkTheme = function () {
    return ipcRenderer.sendSync("getIsDarkTheme");
};

const setIsDarkTheme = function (value: boolean) {
    ipcRenderer.send("setIsDarkTheme", value);
};

////////////////////////////////////////////////////////////////////////////////

interface IMruItem {
    filePath: string;
}
const getMRU: () => IMruItem[] = function () {
    return ipcRenderer.sendSync("getMRU");
};

const setMRU = function (value: IMruItem[]) {
    ipcRenderer.send("setMRU", toJS(value));
};

ipcRenderer.on("mru-changed", async (sender: any, mru: IMruItem[]) => {
    function isMruChanged(mru1: IMruItem[], mru2: IMruItem[]) {
        if (!!mru1 != !!mru) {
            return true;
        }

        if (mru1.length != mru2.length) {
            return true;
        }
        for (let i = 0; i < mru1.length; i++) {
            if (mru1[i].filePath != mru2[i].filePath) {
                return true;
            }
        }
        return false;
    }

    if (isMruChanged(mru, settingsController.mru)) {
        runInAction(() => (settingsController.mru = mru));
    }
});

////////////////////////////////////////////////////////////////////////////////

class SettingsController {
    activeDatabasePath = getDbPath();
    activetLocale = getLocale();
    activeDateFormat = getDateFormat();
    activeTimeFormat = getTimeFormat();

    databasePath: string = getDbPath();
    locale: string = getLocale();
    dateFormat: string = getDateFormat();
    timeFormat: string = getTimeFormat();
    databaseSize: number;
    timeOfLastDatabaseCompactOperation: Date;
    _isCompactDatabaseAdvisable: boolean;
    isDarkTheme: boolean = getIsDarkTheme();
    mru: IMruItem[] = getMRU();

    constructor() {
        makeObservable(this, {
            databasePath: observable,
            locale: observable,
            dateFormat: observable,
            timeFormat: observable,
            databaseSize: observable,
            timeOfLastDatabaseCompactOperation: observable,
            _isCompactDatabaseAdvisable: observable,
            isDarkTheme: observable,
            mru: observable,
            updateTimeOfLastDatabaseCompact: action.bound,
            isCompactDatabaseAdvisable: computed,
            restartRequired: computed,
            onDatabasePathChange: action.bound,
            onLocaleChange: action.bound,
            onDateFormatChanged: action.bound,
            onTimeFormatChanged: action.bound,
            switchTheme: action.bound,
            removeItemFromMRU: action
        });

        var fs = require("fs");

        this.databaseSize = fs.statSync(this.activeDatabasePath).size;

        this.updateTimeOfLastDatabaseCompact();

        setInterval(this.updateTimeOfLastDatabaseCompact, 60 * 1000);

        this.onThemeSwitched();
    }

    updateTimeOfLastDatabaseCompact() {
        let timeOfLastDatabaseCompactOperationStr = localStorage.getItem(
            TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME
        );

        if (timeOfLastDatabaseCompactOperationStr) {
            this.timeOfLastDatabaseCompactOperation = new Date(
                parseInt(timeOfLastDatabaseCompactOperationStr)
            );
        } else {
            this.timeOfLastDatabaseCompactOperation = new Date();
            localStorage.setItem(
                TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME,
                this.timeOfLastDatabaseCompactOperation.getTime().toString()
            );
        }

        this._isCompactDatabaseAdvisable =
            new Date().getTime() -
                this.timeOfLastDatabaseCompactOperation.getTime() >
            CONF_DATABASE_COMPACT_ADVISE_PERIOD;
    }

    get isCompactDatabaseAdvisable() {
        return (
            this.databasePath === this.activeDatabasePath &&
            this._isCompactDatabaseAdvisable
        );
    }

    get restartRequired() {
        return (
            this.databasePath !== this.activeDatabasePath ||
            this.locale !== this.activetLocale ||
            this.dateFormat !== this.activeDateFormat ||
            this.timeFormat !== this.activeTimeFormat
        );
    }

    onDatabasePathChange(databasePath: string) {
        this.databasePath = databasePath;
        setDbPath(this.databasePath);
    }

    onLocaleChange(value: string) {
        this.locale = value;
        setLocale(value);
    }

    onDateFormatChanged(value: string) {
        this.dateFormat = value;
        setDateFormat(value);
    }

    onTimeFormatChanged(value: string) {
        this.timeFormat = value;
        setTimeFormat(value);
    }

    switchTheme(value: boolean) {
        this.isDarkTheme = value;
        setIsDarkTheme(value);
        this.onThemeSwitched();
    }

    onThemeSwitched() {
        const content = document.getElementById(
            "EezStudio_Content"
        ) as HTMLDivElement;
        content.style.opacity = "0";

        const bootstrapLinkElement = document.getElementById(
            "bootstrap-css"
        ) as HTMLLinkElement;

        const mainLinkElement = document.getElementById(
            "main-css"
        ) as HTMLLinkElement;

        const goldenlayoutLinkElement = document.getElementById(
            "goldenlayout-css"
        ) as HTMLLinkElement;

        const flexlayoutLinkElement = document.getElementById(
            "flexlayout-css"
        ) as HTMLLinkElement;

        if (this.isDarkTheme) {
            bootstrapLinkElement.href =
                "../../node_modules/bootstrap-dark-5/dist/css/bootstrap-night.min.css";

            mainLinkElement.href =
                "../eez-studio-ui/_stylesheets/main-dark.css";

            goldenlayoutLinkElement.href =
                "../../node_modules/golden-layout/src/css/goldenlayout-dark-theme.css";

            flexlayoutLinkElement.href =
                "../../node_modules/flexlayout-react/style/dark.css";
        } else {
            bootstrapLinkElement.href =
                "../../node_modules/bootstrap/dist/css/bootstrap.min.css";

            mainLinkElement.href = "../eez-studio-ui/_stylesheets/main.css";

            goldenlayoutLinkElement.href =
                "../../node_modules/golden-layout/src/css/goldenlayout-light-theme.css";

            flexlayoutLinkElement.href =
                "../../node_modules/flexlayout-react/style/light.css";
        }

        setTimeout(() => {
            content.style.opacity = "";
        }, 200);
    }

    removeItemFromMRU(mruItem: IMruItem) {
        const i = this.mru.indexOf(mruItem);
        if (i != -1) {
            this.mru.splice(i, 1);
            setMRU(this.mru);
        }
    }

    createNewDatabase = async () => {
        const result = await dialog.showSaveDialog(getCurrentWindow(), {});
        const filePath = result.filePath;
        if (filePath) {
            try {
                createEmptyFile(filePath);
                notification.success(`New database created`);
            } catch (error) {
                notification.error(error.toString());
            }
        }
    };

    showDatabasePathInFolder = () => {
        shell.showItemInFolder(this.databasePath);
    };

    restart = () => {
        app.relaunch();
        app.exit();
    };

    compactDatabase() {
        showDialog(<CompactDatabaseDialog />);
    }
}

export const settingsController = new SettingsController();

////////////////////////////////////////////////////////////////////////////////

const CompactDatabaseDialog = observer(
    class CompactDatabaseDialog extends React.Component<{}, {}> {
        sizeBefore: number;
        sizeAfter: number | undefined;
        sizeReduced: number | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                sizeBefore: observable,
                sizeAfter: observable,
                sizeReduced: observable
            });

            var fs = require("fs");
            this.sizeBefore = fs.statSync(
                settingsController.activeDatabasePath
            ).size;
        }

        async componentDidMount() {
            try {
                await dbVacuum();

                localStorage.setItem(
                    TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME,
                    new Date().getTime().toString()
                );
                settingsController.updateTimeOfLastDatabaseCompact();

                runInAction(() => {
                    var fs = require("fs");
                    this.sizeAfter = fs.statSync(
                        settingsController.activeDatabasePath
                    ).size;

                    settingsController.databaseSize = this.sizeAfter!;

                    this.sizeReduced =
                        (100 * (this.sizeBefore - this.sizeAfter!)) /
                        this.sizeBefore;
                    if (this.sizeReduced < 1) {
                        this.sizeReduced =
                            Math.round(100 * this.sizeReduced) / 100;
                    } else if (this.sizeReduced < 10) {
                        this.sizeReduced =
                            Math.round(10 * this.sizeReduced) / 10;
                    } else {
                        this.sizeReduced = Math.round(this.sizeReduced);
                    }
                });
            } catch (err) {
                notification.error(err);
            }
        }

        render() {
            return (
                <Dialog
                    open={true}
                    title="Compacting Database"
                    size="small"
                    cancelButtonText="Close"
                    cancelDisabled={this.sizeAfter === undefined}
                >
                    <table className="EezStudio_CompactDatabaseDialogTable">
                        <tbody>
                            <tr>
                                <td>Size before</td>
                                <td>{formatBytes(this.sizeBefore)}</td>
                            </tr>
                            <tr>
                                <td>Size after</td>
                                <td>
                                    {this.sizeAfter !== undefined ? (
                                        formatBytes(this.sizeAfter)
                                    ) : (
                                        <Loader style={{ margin: 0 }} />
                                    )}
                                </td>
                            </tr>
                            {this.sizeReduced !== undefined && (
                                <tr>
                                    <td>Size reduced by </td>
                                    <td>
                                        {formatBytes(
                                            this.sizeBefore - this.sizeAfter!
                                        )}{" "}
                                        or {this.sizeReduced}%
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </Dialog>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Settings = observer(
    class Settings extends React.Component {
        render() {
            const databaseCompactDivClassName = classNames(
                "EezStudio_DatabaseCompactDiv",
                {
                    databaseCompactIsAdvisable:
                        settingsController.isCompactDatabaseAdvisable
                }
            );

            return (
                <div>
                    <div className="EezStudio_HomeSettingsBody">
                        <PropertyList>
                            <FileInputProperty
                                name="Database location"
                                value={settingsController.databasePath}
                                onChange={
                                    settingsController.onDatabasePathChange
                                }
                            />
                            <tr>
                                <td />
                                <td>
                                    <div className="btn-toolbar">
                                        <div className="btn-group me-2">
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={
                                                    settingsController.createNewDatabase
                                                }
                                            >
                                                Create New Database
                                            </button>
                                        </div>
                                        <div className="btn-group me-2">
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={
                                                    settingsController.showDatabasePathInFolder
                                                }
                                            >
                                                Show in Folder
                                            </button>
                                        </div>
                                    </div>
                                    {settingsController.databasePath ===
                                        settingsController.activeDatabasePath && (
                                        <div
                                            className={
                                                databaseCompactDivClassName
                                            }
                                        >
                                            <div>
                                                Database size is{" "}
                                                {formatBytes(
                                                    settingsController.databaseSize
                                                )}
                                                .
                                            </div>
                                            <div>
                                                Database compacted{" "}
                                                {moment(
                                                    settingsController.timeOfLastDatabaseCompactOperation
                                                ).fromNow()}
                                                .
                                            </div>
                                            {settingsController.isCompactDatabaseAdvisable && (
                                                <div>
                                                    {COMPACT_DATABASE_MESSAGE}
                                                </div>
                                            )}
                                            <div className="btn-group me-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={
                                                        settingsController.compactDatabase
                                                    }
                                                >
                                                    Compact Database
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                            <SelectProperty
                                name="Locale"
                                value={settingsController.locale}
                                onChange={settingsController.onLocaleChange}
                            >
                                {Object.keys(LOCALES)
                                    .slice()
                                    .sort((a, b) =>
                                        stringCompare(
                                            (LOCALES as any)[a],
                                            (LOCALES as any)[b]
                                        )
                                    )
                                    .map(locale => (
                                        <option key={locale} value={locale}>
                                            {(LOCALES as any)[locale]}
                                        </option>
                                    ))}
                            </SelectProperty>
                            <SelectProperty
                                name="Date format"
                                value={settingsController.dateFormat}
                                onChange={
                                    settingsController.onDateFormatChanged
                                }
                            >
                                {DATE_FORMATS.map(dateFormat => (
                                    <option
                                        key={dateFormat.format}
                                        value={dateFormat.format}
                                    >
                                        {moment(new Date())
                                            .locale(settingsController.locale)
                                            .format(dateFormat.format)}
                                    </option>
                                ))}
                            </SelectProperty>
                            <SelectProperty
                                name="Time format"
                                value={settingsController.timeFormat}
                                onChange={
                                    settingsController.onTimeFormatChanged
                                }
                            >
                                {TIME_FORMATS.map(timeFormat => (
                                    <option
                                        key={timeFormat.format}
                                        value={timeFormat.format}
                                    >
                                        {moment(new Date())
                                            .locale(settingsController.locale)
                                            .format(timeFormat.format)}
                                    </option>
                                ))}
                            </SelectProperty>
                            <BooleanProperty
                                name={`Dark theme`}
                                value={settingsController.isDarkTheme}
                                onChange={settingsController.switchTheme}
                            />
                        </PropertyList>
                    </div>

                    {settingsController.restartRequired && (
                        <Header className="EezStudio_HomeSettingsBar EezStudio_PanelHeader">
                            <div className="btn-group me-2">
                                <button
                                    className="btn btn-primary EezStudio_PulseTransition"
                                    onClick={settingsController.restart}
                                >
                                    Restart
                                </button>
                            </div>
                        </Header>
                    )}
                </div>
            );
        }
    }
);
