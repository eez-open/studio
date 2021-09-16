import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { List } from "instrument/bb3/objects/List";
import { ListActions } from "instrument/bb3/components/lists-section/ListActions";

export const ListsSectionListItem = observer(({ list }: { list: List }) => {
    const instrumentDate = list.instrumentDate;
    const studioDate = list.studioDate;
    let modifiedInfo;
    if (instrumentDate && studioDate) {
        if (instrumentDate > studioDate) {
            modifiedInfo = `Instrument version is newer (${formatDateTimeLong(
                instrumentDate
            )} > ${formatDateTimeLong(studioDate)})`;
        } else if (studioDate > instrumentDate) {
            modifiedInfo = `Studio version is newer (${formatDateTimeLong(
                studioDate
            )} > ${formatDateTimeLong(instrumentDate)})`;
        } else {
            modifiedInfo = formatDateTimeLong(instrumentDate);
        }
    } else {
        const date = instrumentDate || studioDate;
        modifiedInfo = date ? formatDateTimeLong(date) : null;
    }

    return (
        <div className="list-group-item">
            <div className="EezStudio_BB3_TitleContainer">
                <div className="font-weight-bold">{list.baseName}</div>
                <div>{modifiedInfo}</div>
            </div>
            <div className="EezStudio_BB3_ContentContainer">
                <div>{list.description}</div>
                <ListActions list={list} />
            </div>
        </div>
    );
});
