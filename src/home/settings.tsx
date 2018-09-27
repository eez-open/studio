import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import * as moment from "moment";

const shell = require("electron").shell;
import { app, createEmptyFile } from "shared/util";
import { stringCompare } from "shared/string";
import { getDbPath, setDbPath } from "shared/db";
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
} from "shared/i10n";

import styled from "shared/ui/styled-components";
import { PropertyList, FileInputProperty, SelectProperty } from "shared/ui/properties";
import * as notification from "shared/ui/notification";
import { PanelHeader } from "shared/ui/header-with-body";

////////////////////////////////////////////////////////////////////////////////

const HomeSettingsBody = styled.div`
    padding: 50px 0;
    margin: auto;
    max-width: 640px;
`;

const HomeSettingsBar = styled(PanelHeader)`
    position: absolute;
    bottom: 0;
    width: 100%;
    text-align: right;
    border-bottom-width: 0;
    border-top-width: 1px;
`;

const activeDatabasePath = getDbPath();
const activetLocale = getLocale();
const activeDateFormat = getDateFormat();
const activeTimeFormat = getTimeFormat();

@observer
export class Settings extends React.Component<{}, {}> {
    @observable
    databasePath: string = getDbPath();

    @observable
    locale: string = getLocale();

    @observable
    dateFormat: string = getDateFormat();

    @observable
    timeFormat: string = getTimeFormat();

    @computed
    get restartRequired() {
        return (
            this.databasePath !== activeDatabasePath ||
            this.locale !== activetLocale ||
            this.dateFormat !== activeDateFormat ||
            this.timeFormat !== activeTimeFormat
        );
    }

    @action.bound
    onDatabasePathChange(databasePath: string) {
        this.databasePath = databasePath;
        setDbPath(this.databasePath);
    }

    @action.bound
    onLocaleChange(value: string) {
        this.locale = value;
        setLocale(value);
    }

    @action.bound
    onDateFormatChanged(value: string) {
        this.dateFormat = value;
        setDateFormat(value);
    }

    @action.bound
    onTimeFormatChanged(value: string) {
        this.timeFormat = value;
        setTimeFormat(value);
    }

    @bind
    createNewDatabase() {
        EEZStudio.electron.remote.dialog.showSaveDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            {},
            (filePath: any) => {
                if (filePath) {
                    try {
                        createEmptyFile(filePath);
                        notification.success(`New database created`);
                    } catch (error) {
                        notification.error(error.toString());
                    }
                }
            }
        );
    }

    @bind
    showDatabasePathInFolder() {
        shell.showItemInFolder(this.databasePath);
    }

    @bind
    restart() {
        app.relaunch();
        app.exit();
    }

    render() {
        return (
            <div>
                <HomeSettingsBody>
                    <PropertyList>
                        <FileInputProperty
                            name="Database location"
                            value={this.databasePath}
                            onChange={this.onDatabasePathChange}
                        />
                        <tr>
                            <td />
                            <td>
                                <div className="btn-toolbar">
                                    <div className="btn-group mr-2">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={this.createNewDatabase}
                                        >
                                            Create New Database
                                        </button>
                                    </div>
                                    <div className="btn-group mr-2">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={this.showDatabasePathInFolder}
                                        >
                                            Show in Folder
                                        </button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <SelectProperty
                            name="Locale"
                            value={this.locale}
                            onChange={this.onLocaleChange}
                        >
                            {Object.keys(LOCALES)
                                .slice()
                                .sort((a, b) =>
                                    stringCompare((LOCALES as any)[a], (LOCALES as any)[b])
                                )
                                .map(locale => (
                                    <option key={locale} value={locale}>
                                        {(LOCALES as any)[locale]}
                                    </option>
                                ))}
                        </SelectProperty>
                        <SelectProperty
                            name="Date format"
                            value={this.dateFormat}
                            onChange={this.onDateFormatChanged}
                        >
                            {DATE_FORMATS.map(dateFormat => (
                                <option key={dateFormat.format} value={dateFormat.format}>
                                    {moment(new Date())
                                        .locale(this.locale)
                                        .format(dateFormat.format)}
                                </option>
                            ))}
                        </SelectProperty>
                        <SelectProperty
                            name="Time format"
                            value={this.timeFormat}
                            onChange={this.onTimeFormatChanged}
                        >
                            {TIME_FORMATS.map(timeFormat => (
                                <option key={timeFormat.format} value={timeFormat.format}>
                                    {moment(new Date())
                                        .locale(this.locale)
                                        .format(timeFormat.format)}
                                </option>
                            ))}
                        </SelectProperty>
                    </PropertyList>
                </HomeSettingsBody>

                {this.restartRequired && (
                    <HomeSettingsBar>
                        <div className="btn-group mr-2">
                            <button
                                className="btn btn-primary EezStudio_PulseTransition"
                                onClick={this.restart}
                            >
                                Restart
                            </button>
                        </div>
                    </HomeSettingsBar>
                )}
            </div>
        );
    }
}
