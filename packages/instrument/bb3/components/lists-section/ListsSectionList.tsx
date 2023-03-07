import React from "react";
import { observer } from "mobx-react";

import { List } from "instrument/bb3/objects/List";
import { ListsSectionListItem } from "instrument/bb3/components/lists-section/ListsSectionListItem";
import { guid } from "eez-studio-shared/guid";

export const ListsSectionList = observer(({ lists }: { lists: List[] }) => {
    if (lists.length == 0) {
        return null;
    }

    return (
        <div className="list-group">
            {lists.map(list => (
                <ListsSectionListItem key={guid()} list={list} />
            ))}
        </div>
    );
});
