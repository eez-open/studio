import * as React from "react";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

////////////////////////////////////////////////////////////////////////////////

export interface ITab {
    active: boolean;
    permanent: boolean;
    id: string | number;
    title: string | JSX.Element;
    makeActive(): void;
    makePermanent?(): void;
    close?(): void;
}

////////////////////////////////////////////////////////////////////////////////

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
    onClick() {
        this.props.tab.makeActive();
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
                <i className="close material-icons" onClick={this.onClose}>
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
                onClick={this.onClick}
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

@observer
export class TabsView extends React.Component<
    {
        tabs: ITab[];
    },
    {}
> {
    div: HTMLElement;

    onWheel(e: any) {
        e.preventDefault();
        e.stopPropagation();

        $(this.div)[0].scrollLeft += e.deltaY;
    }

    render() {
        let tabs = this.props.tabs.map(tab => <TabView key={tab.id} tab={tab} />);

        return (
            <div
                ref={ref => (this.div = ref!)}
                className="EezStudio_TabsView"
                onWheel={this.onWheel.bind(this)}
            >
                {tabs}
            </div>
        );
    }
}
