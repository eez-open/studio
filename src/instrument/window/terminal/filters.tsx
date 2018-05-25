import * as React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";

import { PropertyList, BooleanProperty } from "shared/ui/properties";

import { appStore } from "instrument/window/app-store";

import { history } from "instrument/window/history";

@observer
export class Filters extends React.Component {
    render() {
        return (
            <div className="EezStudio_HistroyFilters">
                <PropertyList>
                    <BooleanProperty
                        name={`Connects and disconnects (${
                            history.filterStats.connectsAndDisconnects
                        })`}
                        value={appStore.filters.connectsAndDisconnects}
                        onChange={action(
                            (value: boolean) => (appStore.filters.connectsAndDisconnects = value)
                        )}
                    />
                    <BooleanProperty
                        name={`SCPI commands, queries and query results (${
                            history.filterStats.scpi
                        })`}
                        value={appStore.filters.scpi}
                        onChange={action((value: boolean) => (appStore.filters.scpi = value))}
                    />
                    <BooleanProperty
                        name={`Downloaded files (${history.filterStats.downloadedFiles})`}
                        value={appStore.filters.downloadedFiles}
                        onChange={action(
                            (value: boolean) => (appStore.filters.downloadedFiles = value)
                        )}
                    />
                    <BooleanProperty
                        name={`Uploaded files (${history.filterStats.uploadedFiles})`}
                        value={appStore.filters.uploadedFiles}
                        onChange={action(
                            (value: boolean) => (appStore.filters.uploadedFiles = value)
                        )}
                    />
                    <BooleanProperty
                        name={`Attached files (${history.filterStats.attachedFiles})`}
                        value={appStore.filters.attachedFiles}
                        onChange={action(
                            (value: boolean) => (appStore.filters.attachedFiles = value)
                        )}
                    />
                    <BooleanProperty
                        name={`Charts (${history.filterStats.charts})`}
                        value={appStore.filters.charts}
                        onChange={action((value: boolean) => (appStore.filters.charts = value))}
                    />

                    {appStore.instrument &&
                        appStore.instrument.getListsProperty() && (
                            <BooleanProperty
                                name={`Lists (${history.filterStats.lists})`}
                                value={appStore.filters.lists}
                                onChange={action(
                                    (value: boolean) => (appStore.filters.lists = value)
                                )}
                            />
                        )}
                    <BooleanProperty
                        name={`Notes (${history.filterStats.notes})`}
                        value={appStore.filters.notes}
                        onChange={action((value: boolean) => (appStore.filters.notes = value))}
                    />
                    <BooleanProperty
                        name={`Launched scripts (${history.filterStats.launchedScripts})`}
                        value={appStore.filters.launchedScripts}
                        onChange={action(
                            (value: boolean) => (appStore.filters.launchedScripts = value)
                        )}
                    />
                </PropertyList>
            </div>
        );
    }
}
