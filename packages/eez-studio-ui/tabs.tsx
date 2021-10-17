import React from "react";
import { observer } from "mobx-react";
import { observable, action } from "mobx";
import classNames from "classnames";
import {
    DndProvider,
    useDrag,
    useDrop,
    /*DragSource,
    DropTarget,*/
    DropTargetMonitor
} from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { XYCoord } from "dnd-core";

import { Loader } from "eez-studio-ui/loader";
import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";

const { Menu, MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export interface ITab {
    active: boolean;
    permanent: boolean;
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

        if (moveTab) {
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
                    <span className="title" title={tab.title}>
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

// class TabView2 extends React.Component<TabViewProps> {
//     onMouseUp = (e: React.MouseEvent<HTMLElement>) => {
//         if (e.button === 1) {
//             const tab = this.props.tab;
//             if (tab.close) {
//                 tab.close();
//             }
//         }
//     };

//     onMouseDown = () => {
//         const tab = this.props.tab;
//         tab.makeActive();
//     };

//     onContextMenu = (event: React.MouseEvent) => {
//         event.preventDefault();

//         const menu = new Menu();

//         const tab = this.props.tab;

//         if (tab.openInWindow) {
//             menu.append(
//                 new MenuItem({
//                     label: "Open in New Window",
//                     click: () => tab.openInWindow!()
//                 })
//             );
//         }

//         if (tab.close) {
//             menu.append(
//                 new MenuItem({
//                     label: "Close",
//                     click: () => tab.close!()
//                 })
//             );
//         }

//         if (menu.items.length > 0) {
//             menu.popup({});
//         }
//     };

//     onDoubleClick = () => {
//         const tab = this.props.tab;
//         if (tab.makePermanent) {
//             tab.makePermanent();
//         }
//     };

//     onClose = (e: any) => {
//         e.stopPropagation();
//         const tab = this.props.tab;
//         if (tab.close) {
//             tab.close();
//         }
//     };

//     render() {
//         const { tab, index, moveTab } = this.props;

//         let className = classNames("EezStudio_Tab", {
//             active: tab.active,
//             permanent: tab.permanent
//         });

//         let closeIcon: JSX.Element | undefined;
//         if (tab.close) {
//             closeIcon = (
//                 <i
//                     className="close material-icons"
//                     onClick={this.onClose}
//                     title="Close tab"
//                 >
//                     close
//                 </i>
//             );
//         }

//         let icon;
//         if (typeof tab.icon == "string") {
//             icon = <Icon icon={tab.icon} />;
//         } else {
//             icon = tab.icon;
//         }

//         let title;
//         if (typeof tab.title === "string") {
//             title = (
//                 <>
//                     {icon}
//                     <span className="title" title={tab.title}>
//                         {tab.title}
//                     </span>
//                 </>
//             );
//         } else {
//             title = (
//                 <>
//                     {icon}
//                     {tab.title}
//                 </>
//             );
//         }

//         const opacity = isDragging ? 0 : 1;

//         return (
//             <div
//                 ref={ref}
//                 className={className}
//                 onMouseDown={this.onMouseDown}
//                 onMouseUp={this.onMouseUp}
//                 onContextMenu={this.onContextMenu}
//                 onDoubleClick={this.onDoubleClick}
//                 title={tab.tooltipTitle}
//                 style={{ opacity }}
//                 data-handler-id={handlerId}
//             >
//                 <div>
//                     {title}
//                     {tab.loading && (
//                         <Loader size={24} style={{ marginLeft: 10 }} />
//                     )}
//                     {closeIcon}
//                 </div>
//             </div>
//         );
//     }
// }

// const TabView3 = DragSource(ItemTypes.TAB, undefined, (monitor: any) => ({
//     isDragging: monitor.isDragging()
// }))(TabView2);

////////////////////////////////////////////////////////////////////////////////

const AddTabButton = observer(
    ({ popup, attention }: { popup: React.ReactNode; attention?: boolean }) => {
        const [open, setOpen] = React.useState<boolean>(false);
        const [alignRight, setAlignRight] = React.useState<boolean>(false);

        const popupContainerRef = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
            setTimeout(() => {
                if (open && popupContainerRef && popupContainerRef.current) {
                    var bounding =
                        popupContainerRef.current.getBoundingClientRect();
                    setAlignRight(bounding.right > window.innerWidth);
                } else {
                    setAlignRight(false);
                }
            });
        }, [open, popupContainerRef, popupContainerRef.current]);

        React.useEffect(() => {
            if (!open) {
                return;
            }

            const onClick = (event: MouseEvent) => {
                setOpen(false);
            };

            const element = document.createElement("div");
            element.style.position = "fixed";
            element.style.left = "0";
            element.style.top = "0";
            element.style.width = "100%";
            element.style.height = "100%";
            element.style.zIndex = "999";
            element.style.background = "rgba(0,0,0,0.2)";
            document.body.appendChild(element);

            window.addEventListener("click", onClick, true);

            return () => {
                window.removeEventListener("click", onClick, true);
                element.remove();
            };
        }, [open]);

        const addTabPopupClassName = classNames({ open, alignRight });

        return (
            <div className="EezStudio_AddTab">
                <IconAction
                    icon="material:add"
                    attention={attention}
                    onClick={() => setOpen(!open)}
                    title="Add Tab"
                />
                <div ref={popupContainerRef} className={addTabPopupClassName}>
                    <div>{popup}</div>
                </div>
            </div>
        );
    }
);

@observer
export class TabsView extends React.Component<{
    tabs: ITab[];
    addTabPopup?: React.ReactNode;
    addTabAttention?: boolean;
    moveTab?: (dragIndex: number, hoverIndex: number) => void;
}> {
    ref = React.createRef<HTMLDivElement>();

    @observable el: HTMLDivElement | null = null;

    @action
    componentDidMount() {
        this.el = this.ref.current;
    }

    render() {
        return (
            <div className="EezStudio_TabsView" ref={this.ref}>
                {this.el && (
                    <DndProvider backend={HTML5Backend}>
                        {this.props.tabs.map((tab, index) => (
                            <TabView
                                key={tab.id}
                                tab={tab}
                                index={index}
                                moveTab={this.props.moveTab}
                            />
                        ))}
                    </DndProvider>
                )}
                {this.props.addTabPopup && (
                    <AddTabButton
                        popup={this.props.addTabPopup}
                        attention={this.props.addTabAttention}
                    />
                )}
            </div>
        );
    }
}
