import * as React from "react";
import { observer } from "mobx-react";

import { EezObject, PropertyMetaData } from "project-editor/core/metaData";

import {
    NavigationStore,
    getChildren,
    showContextMenu,
    cloneObject,
    objectToClipboardData,
    updateObject,
    addObject,
    insertObjectBefore,
    findPastePlaceInside,
    hasAncestor,
    isArray,
    isArrayElement,
    isSameInstanceTypeAs,
    objectToString,
    setClipboardData,
    getObjectFromObjectId,
    canCut,
    cutItem,
    canCopy,
    copyItem,
    canPaste,
    pasteItem,
    canDelete,
    deleteItem
} from "project-editor/core/store";

import { DragAndDropManager, DropPosition } from "project-editor/core/dd";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DropMark extends React.Component<{}, {}> {
    render() {
        return (
            <div className="EezStudio_ProjectEditor_drop-mark">
                <i className="material-icons">chevron_right</i>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface DropPlaceholderProps {
    object: EezObject;
}

@observer
export class DropPlaceholder extends React.Component<DropPlaceholderProps, {}> {
    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        DragAndDropManager.setDropEffect(event);

        DragAndDropManager.setDropObjectAndPosition(this.props.object, DropPosition.DROP_INSIDE);
    }

    onDragLeave() {
        DragAndDropManager.unsetDropObjectAndPosition();
    }

    render() {
        let className = "EezStudio_ProjectEditor_drop-placeholder";

        if (
            this.props.object == DragAndDropManager.dropObject &&
            DragAndDropManager.dropPosition == DropPosition.DROP_INSIDE
        ) {
            className += " drop-target";
        }

        return (
            <div
                className={className}
                onDragOver={this.onDragOver.bind(this)}
                onDragLeave={this.onDragLeave.bind(this)}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ListItemProps {
    navigationObject: EezObject;
    item: EezObject;
    onDoubleClick?: (object: EezObject) => void;
    filter?: (object: EezObject) => boolean;
}

@observer
export class ListItem extends React.Component<ListItemProps, {}> {
    refs: {
        [key: string]: Element;
        item: HTMLDivElement;
    };
    index: number;

    ensureVisible() {
        setTimeout(() => {
            if (!DragAndDropManager.dragObject) {
                if ($(this.refs.item).hasClass("selected")) {
                    ($(this.refs.item)[0] as any).scrollIntoViewIfNeeded();
                }
            }
        }, 0);
    }

    componentDidMount() {
        $(this.refs.item).on("contextmenu", event => {
            event.preventDefault();

            let selectedItem = NavigationStore.getNavigationSelectedItem(
                this.props.navigationObject
            );

            if (this.props.item == selectedItem) {
                showContextMenu(this.props.item);
            } else {
                NavigationStore.setNavigationSelectedItem(
                    this.props.navigationObject,
                    this.props.item
                );
                setTimeout(() => {
                    showContextMenu(this.props.item);
                });
            }
        });

        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    onDragStart(event: any) {
        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(event, objectToClipboardData(this.props.item));
        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);

        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, this.props.item);
        });
    }

    onDrag(event: any) {
        DragAndDropManager.drag(event);
    }

    onDragEnd(event: any) {
        DragAndDropManager.end(event);
    }

    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        if (hasAncestor(this.props.item, DragAndDropManager.dragObject)) {
            return;
        }

        DragAndDropManager.delayedOnDragOver(() => {
            if (!DragAndDropManager.dragObject) {
                return;
            }

            if (hasAncestor(this.props.item, DragAndDropManager.dragObject)) {
                return;
            }

            let dropPosition = DropPosition.DROP_NONE;

            if (
                isArrayElement(this.props.item) &&
                DragAndDropManager.dragObject &&
                isSameInstanceTypeAs(this.props.item, DragAndDropManager.dragObject)
            ) {
                dropPosition = DropPosition.DROP_BEFORE;
            } else {
                if (isArray(this.props.item)) {
                    if (
                        this.props.item.$eez.metaData == DragAndDropManager.dragObject.$eez.metaData
                    ) {
                        dropPosition = DropPosition.DROP_INSIDE;
                    }
                } else {
                    if (
                        findPastePlaceInside(
                            this.props.item,
                            DragAndDropManager.dragObject.$eez.metaData,
                            true
                        )
                    ) {
                        dropPosition = DropPosition.DROP_INSIDE;
                    }
                }
            }

            if (dropPosition != DropPosition.DROP_NONE) {
                DragAndDropManager.setDropObjectAndPosition(this.props.item, dropPosition);
            }
        });

        event.preventDefault();
        event.stopPropagation();
        DragAndDropManager.setDropEffect(event);
    }

    onDragLeave() {
        DragAndDropManager.unsetDropObjectAndPosition();
    }

    onClick(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        e.stopPropagation();

        // TODO multiple selection

        // if (e.ctrlKey) {
        //     toggleSelected(this.props.item.object);
        // } else {
        //     selectItems([this.props.item.object]);
        // }

        NavigationStore.setNavigationSelectedItem(this.props.navigationObject, this.props.item);
    }

    onDoubleClick(e: any) {
        e.preventDefault();
        e.stopPropagation();

        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(this.props.item);
        }
    }

    render() {
        let className = "EezStudio_ProjectEditor_list-item";

        let selectedItem = NavigationStore.getNavigationSelectedItem(this.props.navigationObject);

        if (this.props.item == selectedItem) {
            className += " selected";
        }

        if (DragAndDropManager.dragObject == this.props.item) {
            className += " drag-source";
        }

        if (
            this.props.item == DragAndDropManager.dropObject &&
            DragAndDropManager.dropPosition == DropPosition.DROP_INSIDE
        ) {
            className += " drop-target";
        }

        return (
            <div
                ref="item"
                data-object-id={this.props.item.$eez.id}
                className={className}
                onClick={this.onClick.bind(this)}
                onDoubleClick={this.onDoubleClick.bind(this)}
                draggable={true}
                onDragStart={this.onDragStart.bind(this)}
                onDrag={this.onDrag.bind(this)}
                onDragEnd={this.onDragEnd.bind(this)}
                onDragOver={this.onDragOver.bind(this)}
                onDragLeave={this.onDragLeave.bind(this)}
            >
                {this.props.item.$eez.metaData.listLabel
                    ? this.props.item.$eez.metaData.listLabel(this.props.item)
                    : objectToString(this.props.item)}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ListProps {
    navigationObject: EezObject;
    onDoubleClick?: (object: EezObject) => void;
    tabIndex?: number;
    onFocus?: () => void;
}

@observer
export class List extends React.Component<ListProps, {}> {
    static defaultProps = {
        tabIndex: -1
    };

    refs: {
        [key: string]: Element;
        list: HTMLDivElement;
    };

    dragAndDropUpdateTimeoutId: any;

    constructor(props: ListProps) {
        super(props);

        this.state = {
            dropItem: undefined
        };
    }

    componentWillReceiveProps(nextProps: ListProps) {
        this.setState({
            dropItem: undefined
        });
    }

    onDoubleClick(object: EezObject) {
        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(object);
        }
    }

    onSelect(objectId: string) {
        let item = getObjectFromObjectId(objectId);
        if (item) {
            NavigationStore.setNavigationSelectedItem(this.props.navigationObject, item);
        }
    }

    onKeyDown(event: any) {
        let focusedItemId = $(this.refs.list)
            .find(".EezStudio_ProjectEditor_list-item.selected")
            .attr("data-object-id");

        if (!focusedItemId) {
            return;
        }

        let focusedItem = getObjectFromObjectId(focusedItemId);

        let $focusedItem = $(this.refs.list).find(
            `.EezStudio_ProjectEditor_list-item[data-object-id="${focusedItemId}"]`
        );

        if (event.altKey) {
        } else if (event.shiftKey) {
        } else if (event.ctrlKey) {
            if (event.keyCode == "X".charCodeAt(0)) {
                if (focusedItem && canCut(focusedItem)) {
                    cutItem(focusedItem);
                }
            } else if (event.keyCode == "C".charCodeAt(0)) {
                if (focusedItem && canCopy(focusedItem)) {
                    copyItem(focusedItem);
                }
            } else if (event.keyCode == "V".charCodeAt(0)) {
                if (focusedItem && canPaste(focusedItem)) {
                    pasteItem(focusedItem);
                }
            }
        } else if (event.keyCode == 46) {
            // delete
            if (focusedItem && canDelete(focusedItem)) {
                deleteItem(focusedItem);
            }
        } else {
            if (
                event.keyCode == 38 ||
                event.keyCode == 40 ||
                event.keyCode == 33 ||
                event.keyCode == 34 ||
                event.keyCode == 36 ||
                event.keyCode == 35
            ) {
                let $rows = $(this.refs.list).find(".EezStudio_ProjectEditor_list-item");
                let index = $rows.index($focusedItem);

                let pageSize = Math.floor($(this.refs.list).height()! / $rows.height()!);

                if (event.keyCode == 38) {
                    // up
                    --index;
                } else if (event.keyCode == 40) {
                    // down
                    ++index;
                } else if (event.keyCode == 33) {
                    // page up
                    index -= pageSize;
                } else if (event.keyCode == 34) {
                    // page down
                    index += pageSize;
                } else if (event.keyCode == 36) {
                    // home
                    index = 0;
                } else if (event.keyCode == 35) {
                    // end
                    index = $rows.length - 1;
                }

                if (index < 0) {
                    index = 0;
                } else if (index >= $rows.length) {
                    index = $rows.length - 1;
                }

                let newFocusedItemId = $($rows[index]).attr("data-object-id");
                if (newFocusedItemId) {
                    this.onSelect(newFocusedItemId);
                }

                event.preventDefault();
            }
        }
    }

    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        DragAndDropManager.setDropEffect(event);
    }

    onDrop(event: any) {
        if (DragAndDropManager.dropObject) {
            let dropPosition = DragAndDropManager.dropPosition;

            DragAndDropManager.deleteDragItem();

            if (DragAndDropManager.dragObject) {
                let object = cloneObject(undefined, DragAndDropManager.dragObject);

                if (dropPosition == DropPosition.DROP_BEFORE) {
                    insertObjectBefore(DragAndDropManager.dropObject, object);
                } else if (dropPosition == DropPosition.DROP_INSIDE) {
                    let dropPlace = findPastePlaceInside(
                        DragAndDropManager.dropObject,
                        object.$eez.metaData,
                        true
                    );
                    if (dropPlace) {
                        if (isArray(dropPlace as EezObject)) {
                            addObject(dropPlace as EezObject, object);
                        } else {
                            updateObject(DragAndDropManager.dropObject, {
                                [(dropPlace as PropertyMetaData).name]: object
                            });
                        }
                    }
                }
            }

            DragAndDropManager.end(event);
        }
    }

    render() {
        let className = "EezStudio_ProjectEditor_list layoutCenter";

        if (DragAndDropManager.dragObject) {
            className += " drag-source";
        }

        let children = getChildren(this.props.navigationObject);

        let childrenElements: JSX.Element[] = [];

        children.forEach(child => {
            if (
                child == DragAndDropManager.dropObject &&
                DragAndDropManager.dropPosition == DropPosition.DROP_BEFORE
            ) {
                childrenElements.push(<DropMark key="drop-mark" />);
            }

            childrenElements.push(
                <ListItem
                    navigationObject={this.props.navigationObject}
                    key={child.$eez.id}
                    item={child}
                    onDoubleClick={this.props.onDoubleClick}
                />
            );
        });

        if (
            DragAndDropManager.dragObject &&
            !hasAncestor(this.props.navigationObject, DragAndDropManager.dragObject)
        ) {
            let addDropPlaceholder = false;

            if (isArray(this.props.navigationObject)) {
                if (
                    this.props.navigationObject.$eez.metaData ==
                    DragAndDropManager.dragObject.$eez.metaData
                ) {
                    addDropPlaceholder = true;
                }
            } else {
                let place = findPastePlaceInside(
                    this.props.navigationObject,
                    DragAndDropManager.dragObject.$eez.metaData,
                    true
                );
                if (place) {
                    addDropPlaceholder = true;
                }
            }

            if (addDropPlaceholder) {
                childrenElements.push(
                    <DropPlaceholder key="drop-placeholder" object={this.props.navigationObject} />
                );
            }
        }

        return (
            <div
                ref="list"
                className={className}
                tabIndex={this.props.tabIndex}
                onKeyDown={this.onKeyDown.bind(this)}
                onFocus={() => this.props.onFocus && this.props.onFocus()}
            >
                <div onDrop={this.onDrop.bind(this)}>{childrenElements}</div>
            </div>
        );
    }
}
