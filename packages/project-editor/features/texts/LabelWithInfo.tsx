import React from "react";

export function LabelWithInfo({
    label,
    info
}: {
    label: string;
    info: number;
}) {
    return (
        <div className="EezStudio_LabelWithInfo">
            <div className="label1">{label}</div>
            <div>{info}</div>
        </div>
    );
}
