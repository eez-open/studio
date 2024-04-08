import React from "react";

import * as FlexLayout from "flexlayout-react";

export class FlexLayoutContainer extends React.Component<{
    model: FlexLayout.Model;
    factory: (node: FlexLayout.TabNode) => React.ReactNode;
    onRenderTab?: (
        node: FlexLayout.TabNode,
        renderValues: FlexLayout.ITabRenderValues
    ) => void;
    iconFactory?: FlexLayout.IconFactory;
    onAuxMouseClick?: FlexLayout.NodeMouseEvent;
    onContextMenu?: FlexLayout.NodeMouseEvent;
    onModelChange?: (
        model: FlexLayout.Model,
        action: FlexLayout.Action
    ) => void;
    font?: FlexLayout.IFontValues;
}> {
    render() {
        return (
            <FlexLayout.Layout
                model={this.props.model}
                factory={this.props.factory}
                realtimeResize={true}
                onRenderTab={this.props.onRenderTab}
                iconFactory={this.props.iconFactory}
                onAuxMouseClick={this.props.onAuxMouseClick}
                onContextMenu={this.props.onContextMenu}
                onModelChange={this.props.onModelChange}
                font={this.props.font}
            />
        );
    }
}
