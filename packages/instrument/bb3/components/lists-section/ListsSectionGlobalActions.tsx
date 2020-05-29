import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

import { getConnection } from "instrument/window/connection";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

const Container = styled.div`
    & > button {
        margin-left: 10px;
        &:first-child {
            margin-left: 0;
        }
    }
`;

export const ListsSectionGlobalActions = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (!getConnection(bb3Instrument.appStore).isConnected) {
            return null;
        }

        if (bb3Instrument.busy) {
            return null;
        }

        return (
            <Container>
                {bb3Instrument.canDownloadAllLists && (
                    <button
                        className="btn btn-sm btn-primary text-nowrap"
                        onClick={bb3Instrument.downloadAllLists}
                    >
                        Dowload All
                    </button>
                )}

                {bb3Instrument.canUploadAllLists && (
                    <button
                        className="btn btn-sm btn-primary text-nowrap"
                        onClick={bb3Instrument.uploadAllLists}
                    >
                        Upload All
                    </button>
                )}
            </Container>
        );
    }
);
