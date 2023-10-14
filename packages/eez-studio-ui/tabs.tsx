import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Loader } from "eez-studio-ui/loader";
import { Icon } from "eez-studio-ui/icon";

import { Menu, MenuItem } from "@electron/remote";

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

export const TabView: React.FC<TabViewProps> = observer(function TabView({
    tab,
    index,
    moveTab
}) {
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

    const onClose = React.useCallback(
        (e: any) => {
            e.stopPropagation();
            if (tab.close) {
                tab.close();
            }
        },
        [tab]
    );

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
                <span className="title" title={tab.tooltipTitle || tab.title}>
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

    const opacity = 1;

    return (
        <div
            className={className}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onContextMenu={onContextMenu}
            title={tab.tooltipTitle}
            style={{ opacity }}
            draggable={!tab.dragDisabled}
            onDragStart={ev => {
                ev.dataTransfer.setData(
                    "application/eez-studio-tab",
                    index.toString()
                );
                ev.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={ev => {
                ev.preventDefault();
                ev.stopPropagation();

                if (
                    ev.dataTransfer.types.indexOf(
                        "application/eez-studio-tab"
                    ) == -1 ||
                    index == 0
                ) {
                    ev.dataTransfer.dropEffect = "none";
                    return;
                }

                ev.dataTransfer.dropEffect = "move";
            }}
            onDrop={ev => {
                ev.preventDefault();
                const dragIndex = parseInt(
                    ev.dataTransfer.getData("application/eez-studio-tab")
                );
                if (moveTab) {
                    moveTab(dragIndex, index);
                }
            }}
        >
            <div>
                {title}
                {tab.loading && <Loader size={24} style={{ marginLeft: 10 }} />}
                {closeIcon}
            </div>
        </div>
    );
});

////////////////////////////////////////////////////////////////////////////////

export const TabsView = observer(
    class TabsView extends React.Component<{
        tabs: ITab[];
        addTabTitle?: string;
        addTabIcon?: string;
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
                </div>
            );
        }
    }
);
