import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { Toolbar } from "shared/ui/toolbar";
import { IconAction } from "shared/ui/action";
import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";

////////////////////////////////////////////////////////////////////////////////

@observer
class ZoomedPreview extends React.Component<{
    toolbar?: JSX.Element;
    className: string;
    toggleZoom: (event: React.MouseEvent<HTMLElement>) => void;
}> {
    el: HTMLDivElement;

    constructor(props: any) {
        super(props);

        this.el = document.createElement("div");
        this.el.tabIndex = 0;
    }

    componentDidMount() {
        document.getElementById("EezStudio_ModalContent")!.appendChild(this.el);
        this.el.focus();
    }

    componentWillUnmount() {
        document.getElementById("EezStudio_ModalContent")!.removeChild(this.el);
    }

    @bind
    onContextMenu(event: React.MouseEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
    }

    render() {
        let className = classNames("EezStudio_HistoryItem_ZoomedPreview", this.props.className);
        return ReactDOM.createPortal(
            <VerticalHeaderWithBody className={className} onContextMenu={this.onContextMenu}>
                <Header>
                    <Toolbar />
                    <Toolbar>
                        {this.props.toolbar}
                        <IconAction
                            icon="material:close"
                            iconSize={24}
                            title="Leave full screen mode"
                            onClick={this.props.toggleZoom}
                        />
                    </Toolbar>
                </Header>
                <Body>{this.props.children}</Body>
            </VerticalHeaderWithBody>,
            this.el
        );
    }
}

@observer
class UnzoomedPreview extends React.Component<{
    className: string;
    toggleZoom: (event: React.MouseEvent<HTMLElement>) => void;
}> {
    render() {
        let className = classNames("EezStudio_HistoryItem_UnzoomedPreview", this.props.className);
        return (
            <div className={className} onClick={this.props.toggleZoom}>
                {this.props.children}
            </div>
        );
    }
}

@observer
export class HistoryItemPreview extends React.Component<{
    className: string;
    toolbarWhenZoomed?: JSX.Element;
}> {
    @observable zoom: boolean = false;

    @action.bound
    toggleZoom(event: React.MouseEvent<HTMLElement>) {
        this.zoom = !this.zoom;
        event.preventDefault();
        event.stopPropagation();
    }

    render() {
        if (this.zoom) {
            return (
                <ZoomedPreview
                    className={this.props.className}
                    toggleZoom={this.toggleZoom}
                    toolbar={this.props.toolbarWhenZoomed}
                >
                    {this.props.children}
                </ZoomedPreview>
            );
        } else {
            return (
                <UnzoomedPreview className={this.props.className} toggleZoom={this.toggleZoom}>
                    {this.props.children}
                </UnzoomedPreview>
            );
        }
    }
}
