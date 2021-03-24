import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";
import { Loader } from "eez-studio-ui/loader";
import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";
import { scrollIntoViewIfNeeded } from "eez-studio-shared/dom";

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

@observer
class TabView extends React.Component<
    {
        tab: ITab;
    },
    {}
> {
    div: HTMLElement;

    ensureVisible() {
        if (this.props.tab.active) {
            scrollIntoViewIfNeeded($(this.div)[0]);
        }
    }

    componentDidMount() {
        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    @bind
    onMouseUp(e: React.MouseEvent<HTMLElement>) {
        if (e.button === 1) {
            if (this.props.tab.close) {
                this.props.tab.close();
            }
        }
    }

    @bind
    onClick() {
        this.props.tab.makeActive();
    }

    @bind
    onContextMenu(event: React.MouseEvent) {
        event.preventDefault();

        const menu = new Menu();

        if (this.props.tab.openInWindow) {
            menu.append(
                new MenuItem({
                    label: "Open in Window",
                    click: () => this.props.tab.openInWindow!()
                })
            );
        }

        if (this.props.tab.close) {
            menu.append(
                new MenuItem({
                    label: "Close",
                    click: () => this.props.tab.close!()
                })
            );
        }

        if (menu.items.length > 0) {
            menu.popup({});
        }
    }

    @bind
    onDoubleClick() {
        if (this.props.tab.makePermanent) {
            this.props.tab.makePermanent();
        }
    }

    @bind
    onClose(e: any) {
        e.stopPropagation();
        if (this.props.tab.close) {
            this.props.tab.close();
        }
    }

    render() {
        let className = classNames("EezStudio_Tab", {
            active: this.props.tab.active,
            permanent: this.props.tab.permanent
        });

        let closeIcon: JSX.Element | undefined;
        if (this.props.tab.close) {
            closeIcon = (
                <i
                    className="close material-icons"
                    onClick={this.onClose}
                    title="Close tab"
                >
                    close
                </i>
            );
        }

        let icon;
        if (typeof this.props.tab.icon == "string") {
            icon = <Icon icon={this.props.tab.icon} />;
        } else {
            icon = this.props.tab.icon;
        }

        let title;
        if (typeof this.props.tab.title === "string") {
            title = (
                <>
                    {icon}
                    <span className="title" title={this.props.tab.title}>
                        {this.props.tab.title}
                    </span>
                </>
            );
        } else {
            title = this.props.tab.title;
        }

        return (
            <div
                ref={ref => (this.div = ref!)}
                className={className}
                onMouseUp={this.onMouseUp}
                onClick={this.onClick}
                onContextMenu={this.onContextMenu}
                onDoubleClick={this.onDoubleClick}
                title={this.props.tab.tooltipTitle}
            >
                <div>
                    {title}
                    {this.props.tab.loading && (
                        <Loader size={24} style={{ marginLeft: 10 }} />
                    )}
                    {closeIcon}
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const TabsViewContainer = styled.div`
    flex-grow: 1;

    height: 37px;
    margin: 0;

    display: flex;
    min-width: 0;
    flex: 1;

    & > div.EezStudio_Tab {
        min-width: 0;
        max-width: 200px;
        flex: 1;

        overflow: hidden;

        height: 37px;
        border-right: 1px solid ${props => props.theme.borderColor};
        padding-left: 10px;
        padding-right: 5px;
        cursor: pointer;
        font-style: italic;

        &.permanent {
            font-style: normal;
        }

        &.active {
            background-color: white;
            font-weight: bold;
            border-bottom: 3px solid
                ${props => props.theme.selectionBackgroundColor};
        }

        & > div {
            display: flex;
            align-items: center;
            height: 30px;
            padding-top: 4px;
            align-content: space-between;
            white-space: nowrap;

            & > img:first-child {
                flex-shrink: 0;
            }

            & > span.title {
                padding-left: 5px;
                flex-grow: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: left;
            }

            & > i.close {
                position: relative;
                font-size: 14px;
                padding-top: 3px;

                &:hover {
                    color: red;
                }
            }
        }
    }

    & > div.EezStudio_AddTab {
        position: relative;

        & > button {
            margin: 3px 4px;
            padding: 3px;
            cursor: pointer;
            &:hover {
                background: #ddd;
            }
        }

        & > div {
            position: absolute;

            &.alignRight {
                right: 0;
            }

            z-index: 1000;

            padding: 5px;
            overflow: hidden;

            visibility: hidden;
            &.open {
                visibility: visible;
            }

            & > div {
                transform: translateY(-100%);
                opacity: 0;

                padding: 10px;
                background-color: white;
                border-radius: 4px;
                box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.25);
            }

            &.open > div {
                transition: all 0.1s;
                transform: translateY(0);
                opacity: 1;
            }
        }
    }

    &::-webkit-scrollbar {
        width: 0;
        height: 0;
    }

    &:hover {
        &::-webkit-scrollbar {
            height: 2px;
        }

        &::-webkit-scrollbar-track {
            background: ${props => props.theme.scrollTrackColor};
        }

        &::-webkit-scrollbar-thumb {
            background: ${props => props.theme.scrollThumbColor};
        }
    }
`;

const AddTabButton = observer(
    ({ popup, attention }: { popup: React.ReactNode; attention?: boolean }) => {
        const [open, setOpen] = React.useState<boolean>(false);
        const [alignRight, setAlignRight] = React.useState<boolean>(false);

        const popupContainerRef = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
            setTimeout(() => {
                if (open && popupContainerRef && popupContainerRef.current) {
                    var bounding = popupContainerRef.current.getBoundingClientRect();
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
}> {
    render() {
        return (
            <TabsViewContainer>
                {this.props.tabs.map(tab => (
                    <TabView key={tab.id} tab={tab} />
                ))}
                {this.props.addTabPopup && (
                    <AddTabButton
                        popup={this.props.addTabPopup}
                        attention={this.props.addTabAttention}
                    />
                )}
            </TabsViewContainer>
        );
    }
}
