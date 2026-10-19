import React from "react";
import { Menu, MenuItem } from "@electron/remote";

import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
} as const;


// bars of different lengths and arrows up and down: sort in both directions
export const SORT_ICON = (
    <svg {...iconProps}>
        <path d="M4 6h7" />
        <path d="M4 12h7" />
        <path d="M4 18h9" />
        <path d="M15 9l3 -3l3 3" />
        <path d="M15 15l3 3l3 -3" />
        <path d="M18 6v12" />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export interface SortMenuItem {
    label: string;
    onClick: () => void;
}

// Toolbar icon button that opens a popup menu with the sort directions.
export class SortMenuButton extends React.Component<{
    icon: React.ReactNode;
    title: string;
    items: SortMenuItem[];
    enabled?: boolean;
}> {
    onClick = () => {
        const menu = new Menu();
        this.props.items.forEach(item =>
            menu.append(
                new MenuItem({
                    label: item.label,
                    click: item.onClick
                })
            )
        );
        menu.popup({});
    };

    render() {
        return (
            <IconAction
                icon={this.props.icon}
                iconSize={17}
                title={this.props.title}
                enabled={this.props.enabled}
                onClick={this.onClick}
            />
        );
    }
}
