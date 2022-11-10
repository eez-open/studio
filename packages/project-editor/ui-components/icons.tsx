import React from "react";

export const LeftArrow = () => (
    <div style={{ marginTop: -2, padding: "0 8px" }}>
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <line x1="5" y1="12" x2="9" y2="16"></line>
            <line x1="5" y1="12" x2="9" y2="8"></line>
        </svg>
    </div>
);

export const RightArrow = () => (
    <div style={{ marginTop: -2, padding: "0 8px" }}>
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <line x1="15" y1="16" x2="19" y2="12"></line>
            <line x1="15" y1="8" x2="19" y2="12"></line>
        </svg>
    </div>
);
