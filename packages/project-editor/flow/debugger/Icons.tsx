import React from "react";
import { IconAction } from "eez-studio-ui/action";

export const MaximizeIcon = ({
    maximized,
    onToggleMaximized
}: {
    maximized: boolean;
    onToggleMaximized: () => void;
}) => (
    <IconAction
        icon={
            maximized ? (
                <svg
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M15 19v-2a2 2 0 0 1 2 -2h2"></path>
                    <path d="M15 5v2a2 2 0 0 0 2 2h2"></path>
                    <path d="M5 15h2a2 2 0 0 1 2 2v2"></path>
                    <path d="M5 9h2a2 2 0 0 0 2 -2v-2"></path>
                </svg>
            ) : (
                <svg
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M4 8v-2a2 2 0 0 1 2 -2h2"></path>
                    <path d="M4 16v2a2 2 0 0 0 2 2h2"></path>
                    <path d="M16 4h2a2 2 0 0 1 2 2v2"></path>
                    <path d="M16 20h2a2 2 0 0 0 2 -2v-2"></path>
                </svg>
            )
        }
        iconSize={20}
        title={maximized ? "Minimize" : "Maximize"}
        onClick={onToggleMaximized}
        className="maximize-icon"
    ></IconAction>
);
