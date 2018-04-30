import * as React from 'react';
import {observer} from 'mobx-react';

////////////////////////////////////////////////////////////////////////////////

export interface Tab {
    active: boolean;
    permanent: boolean;
    id: string|number;
    title: string|JSX.Element;
    makeActive(): void;
    makePermanent?(): void;
    close?(): void;
}

////////////////////////////////////////////////////////////////////////////////

@observer
class TabView extends React.Component<{
    tab: Tab,
}, {}> {
    refs: {
        [key: string]: (Element);
        li: HTMLElement;
    };

    ensureVisible() {
        if (this.props.tab.active) {
            ($(this.refs.li)[0] as any).scrollIntoViewIfNeeded();
        }
    }

    componentDidMount() {
        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    onClick() {
        this.props.tab.makeActive();
    }

    onDoubleClick() {
        if (this.props.tab.makePermanent) {
            this.props.tab.makePermanent();
        }
    }

    onClose(e: any) {
        e.stopPropagation();
        if (this.props.tab.close) {
            this.props.tab.close();
        }
    }

    render() {
        let classes: string[] = [];
        if (this.props.tab.active) {
            classes.push('active');
        }
        if (this.props.tab.permanent) {
            classes.push('permanent');
        }

        let closeIcon: JSX.Element|undefined;
        if (this.props.tab.close) {
            closeIcon = <i className="material-icons" onClick={this.onClose.bind(this)}>close</i>;
        }

        return (
            <li
                ref="li"
                className={classes.join(' ')}
                onClick={this.onClick.bind(this)}
                onDoubleClick={this.onDoubleClick.bind(this)}
            >
                {this.props.tab.title}
                {closeIcon}
            </li>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class TabsView extends React.Component<{
    tabs: Tab[],
}, {}> {
    refs: {
        [key: string]: (Element);
        ul: HTMLElement;
    };

    onWheel(e: any) {
        e.preventDefault();
        e.stopPropagation();

        $(this.refs.ul)[0].scrollLeft += e.deltaY;
    }

    render() {
        let tabs = this.props.tabs.map(tab =>
            <TabView
                key={tab.id}
                tab={tab}
            />
        );

        return (
            <ul ref='ul'
                className='EezStudio_ProjectEditor_tabs-view'
                onWheel={this.onWheel.bind(this)}
            >
                {tabs}
            </ul>
        );
    }
}