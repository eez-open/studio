import React from "react";
import { observer } from "mobx-react";

import { stringCompare } from "eez-studio-shared/string";

import { List } from "instrument/bb3/objects/List";
import { ListsSectionListItem } from "instrument/bb3/components/lists-section/ListsSectionListItem";

export const ListsSectionList = observer(({ lists }: { lists: List[] }) => {
    if (lists.length == 0) {
        return null;
    }

    return (
        <div className="list-group">
            {lists
                .slice()
                .sort((a, b) => stringCompare(a.baseName, b.baseName))
                .map(list => (
                    <ListsSectionListItem key={list.baseName} list={list} />
                ))}
        </div>
    );
});
