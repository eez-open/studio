import React from "react";
import { observer } from "mobx-react";

import { List } from "instrument/bb3/objects/List";
import { ListsSectionListItem } from "instrument/bb3/components/lists-section/ListsSectionListItem";

export const ListsSectionList = observer(({ lists }: { lists: List[] }) => {
    if (lists.length == 0) {
        return null;
    }

    return (
        <div className="list-group">
            {lists.map(list => (
                <ListsSectionListItem
                    key={list.studioList ? list.studioList.id : list.baseName}
                    list={list}
                />
            ))}
        </div>
    );
});
