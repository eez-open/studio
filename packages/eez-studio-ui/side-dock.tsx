import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";
import { Splitter } from "eez-studio-ui/splitter";
import { VerticalHeaderWithBody, Header, Body } from "eez-studio-ui/header-with-body";

@observer
export class DockablePanels extends React.Component<{
    defaultLayoutConfig: any;
    registerComponents: (factory: any) => void;
    layoutId?: string;
    onStateChanged?: (state: any) => void;
}> {
    static DEFAULT_SETTINGS = {
        showPopoutIcon: false,
        showMaximiseIcon: false,
        showCloseIcon: false
    };

    static DEFAULT_DIMENSIONS = {
        borderWidth: 8,
        headerHeight: 26
    };

    containerDiv: HTMLDivElement | null;

    goldenLayout: any;

    lastWidth: number | undefined;
    lastHeight: number | undefined;

    lastLayoutId: string | undefined;

    get layoutConfig() {
        if (this.props.layoutId) {
            const savedStateJSON = localStorage.getItem(this.props.layoutId);
            if (savedStateJSON) {
                try {
                    return JSON.parse(savedStateJSON);
                } catch (err) {
                    console.error(err);
                }
            }
        }
        return this.props.defaultLayoutConfig;
    }

    update() {
        this.destroy();

        if (this.goldenLayout) {
            if (!this.containerDiv) {
                this.destroy();
            }
        } else {
            if (this.containerDiv) {
                try {
                    this.goldenLayout = new GoldenLayout(this.layoutConfig, this.containerDiv);
                    this.props.registerComponents(this.goldenLayout);
                    this.goldenLayout.on("stateChanged", this.onStateChanged);
                    this.goldenLayout.init();

                    this.lastLayoutId = this.props.layoutId;
                } catch (err) {
                    console.error(err);
                    this.destroy();
                }
            }
        }
    }

    get layoutState() {
        return this.goldenLayout.toConfig();
    }

    @bind
    onStateChanged() {
        if (this.goldenLayout) {
            if (this.props.onStateChanged) {
                this.props.onStateChanged(this.goldenLayout.toConfig());
            } else if (this.props.layoutId) {
                localStorage.setItem(this.props.layoutId, JSON.stringify(this.layoutState));
            }
        }
    }

    updateSize() {
        if (this.goldenLayout) {
            const rect = this.containerDiv!.parentElement!.getBoundingClientRect();
            if (this.lastWidth !== rect.width || this.lastHeight !== rect.height) {
                this.goldenLayout.updateSize(rect.width, rect.height);
                this.lastWidth = rect.width;
                this.lastHeight = rect.height;
            }
        }
    }

    destroy() {
        if (this.goldenLayout) {
            this.goldenLayout.destroy();
            this.goldenLayout = undefined;
            this.lastWidth = undefined;
            this.lastHeight = undefined;
        }
    }

    componentDidMount() {
        this.update();
    }

    componentDidUpdate() {
        this.update();
    }

    componentWillUnmount() {
        this.destroy();
    }

    render() {
        return <div ref={ref => (this.containerDiv = ref)} style={{ overflow: "visible" }} />;
    }
}

@observer
export class SideDock extends React.Component<{
    persistId: string;
    layoutId: string;
    defaultLayoutConfig: any;
    registerComponents: (factory: any) => void;
    header?: JSX.Element;
    width: number;
}> {
    static defaultProps = { width: 240 };

    @observable
    isOpen: boolean;

    dockablePanels: DockablePanels | null;

    constructor(props: any) {
        super(props);

        this.isOpen =
            localStorage.getItem(this.props.persistId + "/is-open") === "0" ? false : true;
    }

    @action.bound
    toggleIsOpen() {
        this.isOpen = !this.isOpen;
        localStorage.setItem(this.props.persistId + "/is-open", this.isOpen ? "1" : "0");
    }

    updateSize() {
        if (this.dockablePanels) {
            this.dockablePanels.updateSize();
        }
    }

    render() {
        const dockSwitcherClassName = classNames("EezStudio_SideDockSwitch", {
            EezStudio_SideDockSwitch_Closed: !this.isOpen
        });

        const dockSwitcher = <div className={dockSwitcherClassName} onClick={this.toggleIsOpen} />;

        let sideDock;

        if (this.isOpen) {
            const container = (
                <DockablePanels
                    ref={ref => (this.dockablePanels = ref)}
                    layoutId={this.props.persistId + "/" + this.props.layoutId}
                    defaultLayoutConfig={this.props.defaultLayoutConfig}
                    registerComponents={this.props.registerComponents}
                />
            );

            if (this.props.header) {
                sideDock = (
                    <React.Fragment>
                        <VerticalHeaderWithBody className="EezStudio_SideDock_WithHeader">
                            <Header>{this.props.header}</Header>
                            <Body>{container}</Body>
                        </VerticalHeaderWithBody>
                        {dockSwitcher}
                    </React.Fragment>
                );
            } else {
                sideDock = (
                    <React.Fragment>
                        {container}
                        {dockSwitcher}
                    </React.Fragment>
                );
            }
        } else {
            this.dockablePanels = null;
            sideDock = dockSwitcher;
        }

        if (this.isOpen) {
            return (
                <Splitter
                    type="horizontal"
                    sizes={`100%|${this.props.width}px`}
                    persistId={`${this.props.persistId}/splitter`}
                    childrenOverflow="auto|visible"
                >
                    {this.props.children}
                    {sideDock}
                </Splitter>
            );
        } else {
            return (
                <React.Fragment>
                    {this.props.children}
                    {sideDock}
                </React.Fragment>
            );
        }
    }
}

export const SideDockViewContainer = styled.div`
    height: 100%;
    overflow: auto;
    padding: 10px;

    .EezStudio_SideDockView_PropertyLabel:not(:last-child) {
        margin-bottom: 5px;
    }

    .EezStudio_SideDockView_Property:not(:last-child) {
        margin-bottom: 5px;
    }

    .EezStudio_SideDockView_Property {
        margin-left: 16px;
    }

    table {
        margin-left: 16px;
        font-size: 80%;

        td {
            text-align: center;
        }

        td:first-child {
            max-width: 120px;
            text-align: left;
            padding-right: 4px;
        }

        input {
            padding: 0;
            padding-left: 5px;
        }
    }

    & > div {
        padding-bottom: 10px;
        border-bottom: 1px solid ${props => props.theme.borderColor};
        margin-bottom: 10px;
    }

    & > div:last-child {
        padding-bottom: 0;
        margin-bottom: 0;
        border-bottom: none;
    }

    & > .EezStudio_AxisRulersProperties {
        border-bottom: 0;
        margin-bottom: 0;

        .EezStudio_SideDockView_Property {
            margin-left: 0;
        }

        td:nth-child(1) {
            padding-right: 0;
        }

        td:nth-child(3),
        td:nth-child(5) {
            padding-left: 5px;
        }
    }
`;
