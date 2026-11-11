import React from "react";

import type { SortDirectionType } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

// Search text and sort order entered in the Project Explorer header. List and
// tree navigation components rendered inside the Project Explorer use these
// instead of their own search input and sort control.
export interface IProjectExplorerFilter {
    readonly searchText: string;
    readonly sortDirection: SortDirectionType;
    // Set when the list is one of the sections of the "All" group: the
    // title is shown in the list header and the list is hidden when nothing
    // in it matches the search text.
    readonly title?: string;
}

export const ProjectExplorerFilterContext = React.createContext<
    IProjectExplorerFilter | undefined
>(undefined);

// Header of a list inside the Project Explorer: the section title (in the
// "All" group) and the list buttons (add, delete, ...).
export function ProjectExplorerListHeader(props: {
    explorerFilter: IProjectExplorerFilter;
    buttons: React.ReactNode[];
}) {
    const { explorerFilter, buttons } = props;

    if (!explorerFilter.title && buttons.length == 0) {
        return null;
    }

    return (
        <div className="EezStudio_Title EezStudio_ProjectExplorer_ListToolbar">
            {explorerFilter.title && (
                <div className="EezStudio_ProjectExplorer_SectionTitle">
                    {explorerFilter.title}
                </div>
            )}
            <div className="btn-toolbar">{buttons}</div>
        </div>
    );
}

// in the "All" group, the lists without items matching the search are hidden
export function isHiddenByProjectExplorerSearch(
    explorerFilter: IProjectExplorerFilter | undefined,
    numItems: number
) {
    return (
        !!explorerFilter &&
        !!explorerFilter.title &&
        !!explorerFilter.searchText &&
        numItems == 0
    );
}

export function withProjectExplorerFilter<
    P extends { explorerFilter?: IProjectExplorerFilter }
>(Component: React.ComponentType<P>) {
    const WithProjectExplorerFilter = (props: P) => {
        const explorerFilter = React.useContext(ProjectExplorerFilterContext);
        return React.createElement(Component, { ...props, explorerFilter });
    };
    return WithProjectExplorerFilter;
}
