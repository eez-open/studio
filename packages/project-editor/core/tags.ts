import {
    IEezObject,
    IPropertyGridGroupDefinition,
    PropertyInfo,
    PropertyType
} from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

// Objects listed in the Project Explorer have the "tags" property. It is only
// used for searching: the search text "tag:<text>" finds the objects which
// tags contain the <text>.

export const TAG_SEARCH_PREFIX = "tag:";

export function makeTagsProperty(
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return {
        name: "tags",
        type: PropertyType.String,
        isOptional: true,
        propertyGridGroup,
        formText: `Used only for searching, e.g. search for "${TAG_SEARCH_PREFIX}ui" finds all the objects with "ui" in the tags.`
    };
}

// Returns the text to search in the tags, if search text starts with "tag:",
// otherwise undefined.
function getTagsSearchText(searchText: string) {
    if (searchText.toLowerCase().startsWith(TAG_SEARCH_PREFIX)) {
        return searchText.substring(TAG_SEARCH_PREFIX.length).trim();
    }
    return undefined;
}

// Is object matching the search text: "tag:<text>" searches in the tags,
// otherwise in the object label.
export function isObjectMatchingSearchText(
    object: IEezObject,
    objectLabel: string,
    searchText: string
) {
    const tagsSearchText = getTagsSearchText(searchText);

    if (tagsSearchText != undefined) {
        const tags = (object as any).tags;
        if (typeof tags != "string" || !tags.trim()) {
            return false;
        }
        // "tag:" alone finds all the objects with tags
        return (
            !tagsSearchText ||
            tags.toLowerCase().indexOf(tagsSearchText.toLowerCase()) != -1
        );
    }

    return objectLabel.toLowerCase().indexOf(searchText.toLowerCase()) != -1;
}
