import * as React from "react";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";

const { Menu, MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

export interface ITab {
    active: boolean;
    permanent: boolean;
    id: string | number;
    title: string | JSX.Element;
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
            ($(this.div)[0] as any).scrollIntoViewIfNeeded();
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
    onContextMenu() {
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
        let className = classNames({
            active: this.props.tab.active,
            permanent: this.props.tab.permanent
        });

        let closeIcon: JSX.Element | undefined;
        if (this.props.tab.close) {
            closeIcon = (
                <i className="close material-icons" onClick={this.onClose} title="Close tab">
                    close
                </i>
            );
        }

        let title;
        if (typeof this.props.tab.title === "string") {
            title = <span className="title">{this.props.tab.title}</span>;
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
            >
                <div>
                    {title}
                    {closeIcon}
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const TabsViewContainer = styled.div`
    flex-grow: 1;
    display: flex;
    background-color: ${props => props.theme.panelHeaderColor};
    height: 45px;
    border-bottom: 1px solid ${props => props.theme.borderColor};
    margin: 0;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;

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

    & > div {
        height: 45px;
        border-right: 1px solid ${props => props.theme.borderColor};
        padding-left: 10px;
        padding-right: 10px;
        cursor: pointer;
        font-style: italic;

        &.permanent {
            font-style: normal;
        }

        &.active {
            background-color: white;
            font-weight: bold;
            border-bottom: 3px solid ${props => props.theme.selectionBackgroundColor};
        }

        & > div {
            display: flex;
            align-items: center;
            height: 38px;

            & > span.title {
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            & > i.close {
                visibility: hidden;
                position: relative;
                font-size: 14px;
                padding-left: 6px;

                &:hover {
                    color: red;
                }
            }
        }

        &.active > div > i.close,
        &:hover > div > i.close {
            visibility: visible;
        }
    }
`;

@observer
export class TabsView extends React.Component<{ tabs: ITab[] }> {
    div: HTMLElement;

    onWheel(e: any) {
        e.preventDefault();
        e.stopPropagation();

        $(this.div)[0].scrollLeft += e.deltaY;
    }

    @bind
    setRef(x: any) {
        this.div = x;
    }

    render() {
        let tabs = this.props.tabs.map(tab => <TabView key={tab.id} tab={tab} />);

        return (
            <TabsViewContainer innerRef={this.setRef} onWheel={this.onWheel.bind(this)}>
                {tabs}
            </TabsViewContainer>
        );
    }
}
