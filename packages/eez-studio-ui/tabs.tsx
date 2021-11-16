import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useDrag, useDrop, DropTargetMonitor } from "react-dnd";
import { XYCoord } from "dnd-core";

import { Loader } from "eez-studio-ui/loader";
import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";

const { Menu, MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export interface ITab {
    active: boolean;
    permanent: boolean;
    dragDisabled?: boolean;
    id: string | number;
    title: React.ReactNode;
    tooltipTitle?: string;
    icon?: React.ReactNode;
    loading: boolean;
    makeActive(): void;
    makePermanent?(): void;
    openInWindow?(): void;
    close?(): void;
}

/////////////////////////////// ///////////////////////////////////////////////

export const ItemTypes = {
    TAB: "tab"
};

interface TabViewProps {
    tab: ITab;
    index: number;
    moveTab?: (dragIndex: number, hoverIndex: number) => void;
}

interface DragItem {
    tab: ITab;
    index: number;
}

export const TabView: React.FC<TabViewProps> = observer(
    ({ tab, index, moveTab }) => {
        const onMouseUp = React.useCallback(
            (e: React.MouseEvent<HTMLElement>) => {
                if (e.button === 1) {
                    if (tab.close) {
                        tab.close();
                    }
                }
            },
            [tab]
        );

        const onMouseDown = React.useCallback(() => {
            tab.makeActive();
        }, [tab]);

        const onContextMenu = React.useCallback(
            (event: React.MouseEvent) => {
                event.preventDefault();

                const menu = new Menu();

                if (tab.openInWindow) {
                    menu.append(
                        new MenuItem({
                            label: "Open in New Window",
                            click: () => tab.openInWindow!()
                        })
                    );
                }

                if (tab.close) {
                    menu.append(
                        new MenuItem({
                            label: "Close",
                            click: () => tab.close!()
                        })
                    );
                }

                if (menu.items.length > 0) {
                    menu.popup({});
                }
            },
            [tab]
        );

        const onDoubleClick = React.useCallback(() => {
            if (tab.makePermanent) {
                tab.makePermanent();
            }
        }, [tab]);

        const onClose = React.useCallback(
            (e: any) => {
                e.stopPropagation();
                if (tab.close) {
                    tab.close();
                }
            },
            [tab]
        );

        const ref = React.useRef<HTMLDivElement>(null);

        const [{ handlerId }, drop] = useDrop({
            accept: ItemTypes.TAB,
            collect(monitor) {
                return {
                    handlerId: monitor.getHandlerId()
                };
            },
            hover(item: DragItem, monitor: DropTargetMonitor) {
                if (!ref.current) {
                    return;
                }

                const dragIndex = item.index;
                const hoverIndex = index;

                // Don't replace items with themselves
                if (dragIndex === hoverIndex) {
                    return;
                }

                // Determine rectangle on screen
                const hoverBoundingRect = ref.current?.getBoundingClientRect();

                // Get vertical middle
                const hoverMiddleX =
                    (hoverBoundingRect.right - hoverBoundingRect.left) / 2;

                // Determine mouse position
                const clientOffset = monitor.getClientOffset();

                // Get pixels to the left
                const hoverClientX =
                    (clientOffset as XYCoord).x - hoverBoundingRect.left;

                // Only perform the move when the mouse has crossed half of the items height
                // When dragging downwards, only move when the cursor is below 50%
                // When dragging upwards, only move when the cursor is above 50%

                // Dragging downwards
                if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
                    return;
                }

                // Dragging upwards
                if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
                    return;
                }

                // Time to actually perform the action
                moveTab!(dragIndex, hoverIndex);

                // Note: we're mutating the monitor item here!
                // Generally it's better to avoid mutations,
                // but it's good here for the sake of performance
                // to avoid expensive index searches.
                item.index = hoverIndex;
            }
        });

        const [{ isDragging }, drag] = useDrag({
            type: ItemTypes.TAB,
            item: () => {
                return { tab, index };
            },
            collect: (monitor: any) => ({
                isDragging: monitor.isDragging()
            })
        });

        if (moveTab && !tab.dragDisabled) {
            drag(drop(ref));
        }

        let className = classNames("EezStudio_Tab", {
            active: tab.active,
            permanent: tab.permanent
        });

        let closeIcon: JSX.Element | undefined;
        if (tab.close) {
            closeIcon = (
                <i
                    className="close material-icons"
                    onClick={onClose}
                    title="Close tab"
                >
                    close
                </i>
            );
        }

        let icon;
        if (typeof tab.icon == "string") {
            icon = <Icon icon={tab.icon} />;
        } else {
            icon = tab.icon;
        }

        let title;
        if (typeof tab.title === "string") {
            title = (
                <>
                    {icon}
                    <span
                        className="title"
                        title={tab.tooltipTitle || tab.title}
                    >
                        {tab.title}
                    </span>
                </>
            );
        } else {
            title = (
                <>
                    {icon}
                    {tab.title}
                </>
            );
        }

        const opacity = isDragging ? 0 : 1;

        return (
            <div
                ref={ref}
                className={className}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onContextMenu={onContextMenu}
                onDoubleClick={onDoubleClick}
                title={tab.tooltipTitle}
                style={{ opacity }}
                data-handler-id={handlerId}
            >
                <div>
                    {title}
                    {tab.loading && (
                        <Loader size={24} style={{ marginLeft: 10 }} />
                    )}
                    {closeIcon}
                </div>
            </div>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const AddTabButton = observer(
    ({
        addTabTitle,
        addTabIcon,
        addTabCallback,
        attention
    }: {
        addTabTitle?: string;
        addTabIcon?: string;
        addTabCallback: () => void;
        attention?: boolean;
    }) => {
        return (
            <div className="EezStudio_AddTab">
                <IconAction
                    icon={addTabIcon || "material:add"}
                    attention={attention}
                    onClick={addTabCallback}
                    title={addTabTitle || "Add Tab"}
                />
            </div>
        );
    }
);

@observer
export class TabsView extends React.Component<{
    tabs: ITab[];
    addTabTitle?: string;
    addTabIcon?: string;
    addTabCallback?: () => void;
    addTabAttention?: boolean;
    moveTab?: (dragIndex: number, hoverIndex: number) => void;
}> {
    render() {
        return (
            <div className="EezStudio_TabsView">
                {this.props.tabs.map((tab, index) => (
                    <TabView
                        key={tab.id}
                        tab={tab}
                        index={index}
                        moveTab={this.props.moveTab}
                    />
                ))}
                {this.props.addTabCallback && (
                    <AddTabButton
                        addTabTitle={this.props.addTabTitle}
                        addTabIcon={this.props.addTabIcon}
                        addTabCallback={this.props.addTabCallback}
                        attention={this.props.addTabAttention}
                    />
                )}
            </div>
        );
    }
}
