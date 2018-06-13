import * as React from "react";
import { findDOMNode } from "react-dom";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "shared/util";
import {
    IActivityLogEntry,
    activityLogStore,
    IActivityLogFilterSpecification
} from "shared/activity-log";
import { unwatch } from "shared/notify";
import { findObjectByActivityLogEntry } from "shared/extensions/extensions";

const CONF_ADVANCE_READ_NUM = 5;

function watchHistory(oids: string[] | undefined) {
    const history: IActivityLogEntry[] = observable([]);

    const targetId = activityLogStore.watch(
        {
            createObject(activityLogEntry: IActivityLogEntry) {
                action(() => history.push(activityLogEntry))();
            },

            updateObject(changes: Partial<IActivityLogEntry>) {
                const entry = history.find(entry => entry.id === changes.id);
                if (entry) {
                    action(() => (entry.message = changes.message!))();
                } else {
                    console.error("log entry not found");
                }
            },

            deleteObject(activityLogEntry: IActivityLogEntry) {
                let index = history.findIndex(entry => entry.id === activityLogEntry.id);
                if (index !== -1) {
                    history.splice(index, 1);
                } else {
                    console.error("log entry not found");
                }
            }
        },
        {
            oids: oids
        } as IActivityLogFilterSpecification
    );

    return {
        history: history,
        targetId
    };
}

@observer
export class HistoryItem extends React.Component<
    {
        displayName: boolean;
        historyItem: IActivityLogEntry;
    },
    {}
> {
    render() {
        const { date, type, message } = this.props.historyItem;

        let name;
        let content;

        const object = findObjectByActivityLogEntry(this.props.historyItem);
        if (object) {
            let info = object.activityLogEntryInfo(this.props.historyItem);
            if (info) {
                name = info.name;
                content = info.content;
            }
        }

        if (name === undefined) {
            name = `${type}: ${message.slice(0, 100)}`;
        }

        return (
            <tr>
                <td className="dateColumn">{formatDateTimeLong(date)}</td>
                {this.props.displayName && <td className="nameColumn">{name}</td>}
                <td className="contentColumn">{content}</td>
            </tr>
        );
    }
}

@observer
export class History extends React.Component<{ oids?: string[] }, {}> {
    allHistory: IActivityLogEntry[];
    allHistoryWatchTargetId: string | undefined;
    @observable history: IActivityLogEntry[] = [];
    div: Element;
    fromTop: number = 0;
    animationFrameRequestId: any;

    constructor(props: any) {
        super(props);

        this.onScroll = this.onScroll.bind(this);
        this.lazyLoadSessions = this.lazyLoadSessions.bind(this);

        this.watchHistory(this.props.oids);
    }

    componentDidMount() {
        this.lazyLoadSessions();

        this.div.addEventListener("scroll", this.onScroll);
    }

    componentWillReceiveProps(nextProps: any) {
        if (nextProps.oids != this.props.oids) {
            this.watchHistory(nextProps.oids);
            this.fromTop = 0;
        }
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);
        this.div.removeEventListener("scroll", this.onScroll);
        this.unwatchHistory();
    }

    watchHistory(oids: string[] | undefined) {
        this.unwatchHistory();
        let { history, targetId } = watchHistory(oids);
        this.allHistory = history;
        this.allHistoryWatchTargetId = targetId;
        action(() => (this.history = []))();
    }

    unwatchHistory() {
        if (this.allHistoryWatchTargetId) {
            unwatch(this.allHistoryWatchTargetId);
            this.allHistoryWatchTargetId = undefined;
        }
    }

    lazyLoadSessions() {
        action(() => {
            // immediatelly load all the new sessions that are created after initial query
            if (
                this.history.length > 0 &&
                this.history[this.history.length - 1].id !==
                    this.allHistory[this.allHistory.length - 1].id
            ) {
                for (let i = this.allHistory.length - 2; i >= 0; i--) {
                    if (this.history[this.history.length - 1].id === this.allHistory[i].id) {
                        for (let j = i + 1; j < this.allHistory.length; j++) {
                            this.history.push(this.allHistory[j]);
                        }
                    }
                }
            }

            for (let i = 0; i < CONF_ADVANCE_READ_NUM; i++) {
                if (this.div.scrollTop === 0 && this.history.length < this.allHistory.length) {
                    const session = this.allHistory[
                        this.allHistory.length - 1 - this.history.length
                    ];
                    this.history.unshift(session);
                }
            }
        })();

        this.autoScroll();

        this.animationFrameRequestId = window.requestAnimationFrame(this.lazyLoadSessions);
    }

    autoScroll() {
        let scrollTop = this.div.scrollHeight - this.div.clientHeight - this.fromTop;
        if (scrollTop != this.div.scrollTop) {
            this.div.scrollTop = scrollTop;
        }
    }

    onScroll(event: any) {
        this.fromTop = this.div.scrollHeight - this.div.clientHeight - this.div.scrollTop;
    }

    get displayName(): boolean {
        return !this.props.oids || this.props.oids.length > 1;
    }

    render() {
        const displayName = this.displayName;

        return (
            <div
                ref={(ref: any) => {
                    this.div = findDOMNode(ref) as Element;
                }}
                className="EezStudio_HistoryTable"
            >
                <table className="table">
                    <tbody>
                        {this.history.map(historyItem => (
                            <HistoryItem
                                key={historyItem.id}
                                historyItem={historyItem}
                                displayName={displayName}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}
