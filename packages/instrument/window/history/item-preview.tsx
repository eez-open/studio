import * as React from "react";
import * as ReactDOM from "react-dom";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { VerticalHeaderWithBody, PanelHeader, Body } from "eez-studio-ui/header-with-body";

////////////////////////////////////////////////////////////////////////////////

const ZoomedPreviewBody = styled(VerticalHeaderWithBody)`
    .EezStudio_Toolbar {
        margin-top: 0;
    }

    .EezStudio_Header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    &.EezStudio_ImagePreview {
        img {
            object-fit: contain;
            flex-grow: 1;
            background-color: black;
            cursor: zoom-out;
        }
    }

    &.EezStudio_PdfPreview {
        .EezStudio_Body {
            background-color: #525659;
            overflow: hidden;

            & > div {
                flex-grow: 1;
                display: flex;
                & > WebView {
                    flex-grow: 1;
                }
            }
        }
    }
`;

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
        return ReactDOM.createPortal(
            <ZoomedPreviewBody className={this.props.className} onContextMenu={this.onContextMenu}>
                <PanelHeader>
                    {this.props.toolbar || <Toolbar />}
                    <Toolbar>
                        <IconAction
                            icon="material:close"
                            iconSize={24}
                            title="Leave full screen mode"
                            onClick={this.props.toggleZoom}
                        />
                    </Toolbar>
                </PanelHeader>
                <Body>{this.props.children}</Body>
            </ZoomedPreviewBody>,
            this.el
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const UnzoomedPreviewBody = styled.div`
    cursor: zoom-in;

    &.EezStudio_ImagePreview {
        img {
            background-color: black;
            width: 480px;
        }
    }

    &.EezStudio_PdfPreview {
        & > img {
            pointer-events: none;
            width: 240px;
        }
        & > div > WebView {
            pointer-events: none;
            width: 300px;
            height: 400px;
            overflow: hidden;
        }
    }

    &.EezStudio_ChartPreview {
        background-color: white;
        padding: 8px;

        cursor: zoom-in;

        svg {
            pointer-events: none;
        }

        .EezStudio_ChartView {
            position: static;
            width: 640px;
            /*
            svg {
                height: 200px;
            }
            */
            svg.EezStudio_Chart_XAxis {
                height: 24px;
            }
        }

        &.EezStudio_ChartPreview_BlackBackground {
            background-color: black;
        }

        .EezStudio_ChartView svg {
            height: 162px;
        }
    }
`;

@observer
class UnzoomedPreview extends React.Component<{
    className: string;
    toggleZoom: (event: React.MouseEvent<HTMLElement>) => void;
}> {
    render() {
        return (
            <UnzoomedPreviewBody className={this.props.className} onClick={this.props.toggleZoom}>
                {this.props.children}
            </UnzoomedPreviewBody>
        );
    }
}

@observer
export class HistoryItemPreview extends React.Component<{
    className: string;
    toolbarWhenZoomed?: JSX.Element;
    zoom: boolean;
    toggleZoom: () => void;
}> {
    @bind
    toggleZoom(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        event.stopPropagation();

        this.props.toggleZoom();
    }

    render() {
        if (this.props.zoom) {
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
