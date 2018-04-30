import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

const shell = require("electron").shell;
import { app, createEmptyFile } from "shared/util";
import { stringCompare } from "shared/string";
import { getDbPath, setDbPath } from "shared/db";
import { getLocale, setLocale, LOCALES } from "shared/i10n";

import { PropertyList, FileInputProperty, SelectProperty } from "shared/ui/properties";
import * as notification from "shared/ui/notification";

////////////////////////////////////////////////////////////////////////////////

const activeDatabasePath = getDbPath();
const activetLocale = getLocale();

@observer
export class Settings extends React.Component<{}, {}> {
    @observable databasePath: string = getDbPath();
    @observable locale: string = getLocale();

    @computed
    get restartRequired() {
        return this.databasePath !== activeDatabasePath || this.locale !== activetLocale;
    }

    @action.bound
    onDatabasePathChange(databasePath: string) {
        this.databasePath = databasePath;
        setDbPath(this.databasePath);
    }

    @action.bound
    onLocaleChange(locale: string) {
        this.locale = locale;
        setLocale(this.locale);
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
            <div className="EezStudio_Home_Settings">
                <div className="EezStudio_Home_Settings_Body">
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
                    </PropertyList>
                </div>

                {this.restartRequired && (
                    <div className="EezStudio_Home_Settings_Bar">
                        <div className="btn-group mr-2">
                            <button
                                className="btn btn-primary EezStudio_PulseTransition"
                                onClick={this.restart}
                            >
                                Restart
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}
