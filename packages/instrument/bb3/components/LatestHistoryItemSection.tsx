import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";
import { ErrorBoundary } from "instrument/window/history/list-component";

export const LatestHistoryItemSection = observer(
    class LatestHistoryItemSection extends React.Component<{
        bb3Instrument: BB3Instrument;
    }> {
        constructor(props: { bb3Instrument: BB3Instrument }) {
            super(props);

            makeObservable(this, {
                listItemElement: computed
            });
        }

        get listItemElement() {
            return (
                <ErrorBoundary
                    id={this.props.bb3Instrument.latestHistoryItem!.id}
                >
                    {this.props.bb3Instrument.latestHistoryItem!.getListItemElement(
                        this.props.bb3Instrument.appStore
                    )}
                </ErrorBoundary>
            );
        }

        render() {
            if (!this.props.bb3Instrument.latestHistoryItem) {
                return null;
            }

            return (
                <Section
                    title="Latest history event"
                    body={
                        <div className="EezStudio_LatestHistoryItemSection">
                            {this.listItemElement}
                        </div>
                    }
                />
            );
        }
    }
);
