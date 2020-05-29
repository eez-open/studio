import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { styled } from "eez-studio-ui/styled-components";

import { List } from "instrument/bb3/objects/List";

import { ListActions } from "instrument/bb3/components/lists-section/ListActions";

const TitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const ContentContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > div {
        &:first-child {
            flex-grow: 1;
        }

        & > button {
            margin: 5px;
            &:first-child {
                margin-left: 0;
            }
            &:last-child {
                margin-right: 0;
            }
        }
    }
`;

export const ListsSectionListItem = observer(({ list }: { list: List }) => {
    const instrumentDate = list.instrumentDate;
    const studioDate = list.studioDate;
    let modifiedInfo;
    if (instrumentDate && studioDate) {
        if (instrumentDate > studioDate) {
            modifiedInfo = `Instrument version newer (${formatDateTimeLong(
                instrumentDate
            )} > ${formatDateTimeLong(studioDate)})`;
        } else if (studioDate > instrumentDate) {
            modifiedInfo = `Studio version newer (${formatDateTimeLong(
                studioDate
            )} > ${formatDateTimeLong(instrumentDate)})`;
        } else {
            modifiedInfo = `Same versions (${formatDateTimeLong(instrumentDate)})`;
        }
    } else {
        modifiedInfo = formatDateTimeLong((instrumentDate || studioDate)!);
    }

    return (
        <div className="list-group-item">
            <TitleContainer>
                <h5>{list.baseName}</h5>
                <div>{modifiedInfo}</div>
            </TitleContainer>
            <ContentContainer>
                <div>{list.description}</div>
                <ListActions list={list} />
            </ContentContainer>
        </div>
    );
});
