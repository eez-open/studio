import React from "react";

import * as FlexLayout from "flexlayout-react";

// flexlayout-react >= 0.8 removed the iconFactory and font props from Layout,
// both are emulated here so that all users of FlexLayoutContainer keep the
// old API: iconFactory via onRenderTab (renderValues.leading), font via the
// --flexlayout-font-* CSS variables

export type IconFactory = (node: FlexLayout.TabNode) => React.ReactNode;

export interface IFontValues {
    size?: string;
    family?: string;
}

export class FlexLayoutContainer extends React.Component<{
    model: FlexLayout.Model;
    factory: (node: FlexLayout.TabNode) => React.ReactNode;
    onRenderTab?: (
        node: FlexLayout.TabNode,
        renderValues: FlexLayout.ITabRenderValues
    ) => void;
    iconFactory?: IconFactory;
    onAuxMouseClick?: FlexLayout.NodeMouseEvent;
    onContextMenu?: FlexLayout.NodeMouseEvent;
    onModelChange?: (
        model: FlexLayout.Model,
        action: FlexLayout.Action
    ) => void;
    font?: IFontValues;
}> {
    onRenderTab = (
        node: FlexLayout.TabNode,
        renderValues: FlexLayout.ITabRenderValues
    ) => {
        if (this.props.iconFactory) {
            renderValues.leading = this.props.iconFactory(node);
        }
        if (this.props.onRenderTab) {
            this.props.onRenderTab(node, renderValues);
        }
    };

    render() {
        const layout = (
            <FlexLayout.Layout
                model={this.props.model}
                factory={this.props.factory}
                realtimeResize={true}
                onRenderTab={this.onRenderTab}
                onAuxMouseClick={this.props.onAuxMouseClick}
                onContextMenu={this.props.onContextMenu}
                onModelChange={this.props.onModelChange}
            />
        );

        const font = this.props.font;
        if (!font) {
            return layout;
        }

        const style: React.CSSProperties = { display: "contents" };
        if (font.size) {
            (style as any)["--flexlayout-font-size"] = font.size;
        }
        if (font.family) {
            (style as any)["--flexlayout-font-family"] = font.family;
        }
        return <div style={style}>{layout}</div>;
    }
}
