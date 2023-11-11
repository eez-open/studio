import React from "react";
import { action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

import { IconAction } from "eez-studio-ui/action";

import { IEezObject } from "project-editor/core/object";
import { Panel } from "project-editor/ui-components/Panel";
import { LogItem } from "project-editor/flow/debugger/logs";
import { RuntimeBase } from "project-editor/flow/runtime/runtime";
import { ProjectContext } from "project-editor/project/context";
import { LogPanelFilter } from "project-editor/store/ui-state";

////////////////////////////////////////////////////////////////////////////////

export const LogsPanel = observer(
    class LogsPanel extends React.Component<{
        runtime: RuntimeBase;
    }> {
        onChangeFilter = action(
            (event: React.ChangeEvent<HTMLSelectElement>) => {
                this.props.runtime.projectStore.uiStateStore.logsPanelFilter =
                    event.currentTarget.value as LogPanelFilter;
            }
        );

        render() {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <Panel
                        id="project-editor/runtime-info/logs"
                        title=""
                        buttons={[
                            <div key="filter">
                                <span style={{ marginRight: 5 }}>Filter:</span>
                                <select
                                    className="form-select"
                                    value={
                                        this.props.runtime.projectStore
                                            .uiStateStore.logsPanelFilter
                                    }
                                    onChange={this.onChangeFilter}
                                >
                                    <option value="all">All</option>
                                    <option value="fatal">Fatal</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                    <option value="debug">Debug</option>
                                    <option value="scpi">SCPI</option>
                                </select>
                            </div>,
                            <IconAction
                                key="clear"
                                icon="material:delete"
                                iconSize={20}
                                title="Clear logs"
                                onClick={this.props.runtime.logs.clear}
                            ></IconAction>
                        ]}
                        body={
                            <LogList
                                runtime={this.props.runtime}
                                filter={
                                    this.props.runtime.projectStore.uiStateStore
                                        .logsPanelFilter
                                }
                            />
                        }
                    />
                </div>
            );
        }
    }
);

const LogList = observer(
    class LogList extends React.Component<{
        runtime: RuntimeBase;
        filter: LogPanelFilter;
    }> {
        constructor(props: { runtime: RuntimeBase; filter: LogPanelFilter }) {
            super(props);

            makeObservable(this, {
                logs: computed
            });
        }

        get logs() {
            const logs = this.props.runtime.logs.logs.slice().reverse();
            if (this.props.filter == "all") {
                return logs;
            }
            return logs.filter(logItem => logItem.type == this.props.filter);
        }

        render() {
            const itemCount = this.logs.length;
            return (
                <div style={{ height: "100%" }}>
                    <AutoSizer>
                        {({ width, height }) => (
                            <List
                                itemCount={itemCount}
                                itemData={
                                    {
                                        logs: this.logs
                                    } as any
                                }
                                itemSize={24}
                                width={width}
                                height={height}
                            >
                                {LogItemRow}
                            </List>
                        )}
                    </AutoSizer>
                </div>
            );
        }
    }
);

const LogItemRow = observer(
    class LogItemRow extends React.Component<{
        index: number;
        style: React.CSSProperties;
        data: any;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: {
            index: number;
            style: React.CSSProperties;
            data: LogItem;
        }) {
            super(props);

            makeObservable(this, {
                selectNode: action.bound
            });
        }

        get runtime() {
            return this.context.runtime!;
        }

        selectNode(logItem: LogItem) {
            this.runtime.logs.selectedLogItem = logItem;
            if (!logItem) {
                return;
            }

            this.runtime.selectedFlowState = logItem.flowState;

            const objects: IEezObject[] = [];

            if (logItem.connectionLine) {
                if (logItem.connectionLine.sourceComponent) {
                    objects.push(logItem.connectionLine.sourceComponent);
                }

                if (logItem.connectionLine) {
                    objects.push(logItem.connectionLine);
                }

                if (logItem.connectionLine.targetComponent) {
                    objects.push(logItem.connectionLine.targetComponent);
                }
            } else if (logItem.component) {
                objects.push(logItem.component);
            }

            if (objects.length > 0) {
                this.context.navigationStore.showObjects(
                    objects,
                    true,
                    false,
                    false
                );
            } else if (logItem.flowState?.flow) {
                this.context.navigationStore.showObjects(
                    [logItem.flowState?.flow],
                    true,
                    false,
                    false
                );
            }
        }

        render() {
            const logItem = ((this.props.data as any).logs as LogItem[])[
                this.props.index
            ];

            return (
                <div
                    className={classNames("log-item", logItem.type, {
                        selected: logItem == this.runtime.logs.selectedLogItem
                    })}
                    style={this.props.style}
                    onClick={() => this.selectNode(logItem)}
                >
                    <small>{logItem.date.toLocaleTimeString()}</small>
                    <small>{logItem.flowState?.flowStateIndex}</small>
                    <span title={logItem.label}>{logItem.label}</span>
                </div>
            );
        }
    }
);
