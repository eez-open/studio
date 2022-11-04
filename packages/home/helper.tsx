import React from "react";

import { ProjectType } from "project-editor/project/project";

export function getProjectIcon(
    filePath: string,
    projectType: string,
    size: number
) {
    const isProject = filePath.endsWith(".eez-project");

    if (isProject) {
        if (projectType == ProjectType.LVGL) {
            return "../eez-studio-ui/_images/eez-project-lvgl.png";
        }

        if (projectType == ProjectType.DASHBOARD) {
            return (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width={size}
                    height={size}
                >
                    <path d="M21 16V4H3v12h18m0-14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7v2h2v2H8v-2h2v-2H3c-1.11 0-2-.9-2-2V4c0-1.11.89-2 2-2h18M5 6h9v5H5V6m10 0h4v2h-4V6m4 3v5h-4V9h4M5 12h4v2H5v-2m5 0h4v2h-4v-2Z" />
                </svg>
            );
        }

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 18"
                width={size}
                height={size}
            >
                <g fill="none" fillRule="evenodd">
                    <path d="M-2-3h24v24H-2z" />
                    <path
                        d="M20 5c0-.55-.45-1-1-1h-1V2c0-1.1-.9-2-2-2H2C.9 0 0 .9 0 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h1c.55 0 1-.45 1-1s-.45-1-1-1h-1v-2h1c.55 0 1-.45 1-1s-.45-1-1-1h-1V6h1c.55 0 1-.45 1-1Zm-5 11H3c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1ZM4.5 10h4c.28 0 .5.22.5.5v3c0 .28-.22.5-.5.5h-4c-.28 0-.5-.22-.5-.5v-3c0-.28.22-.5.5-.5Zm6-6h3c.28 0 .5.22.5.5v2c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5v-2c0-.28.22-.5.5-.5Zm-6 0h4c.28 0 .5.22.5.5v4c0 .28-.22.5-.5.5h-4c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5Zm6 4h3c.28 0 .5.22.5.5v5c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5v-5c0-.28.22-.5.5-.5Z"
                        fill="currentColor"
                    />
                </g>
            </svg>
        );
    }

    return "../eez-studio-ui/_images/eez-dashboard.png";
}
