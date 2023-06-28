import React from "react";
import { Icon } from "eez-studio-ui/icon";

export function LabelWithProgress({
    label,
    progress
}: {
    label: string;
    progress: number;
}) {
    if (isNaN(progress)) {
        progress = 0;
    }

    progress *= 100;
    return (
        <div className="EezStudio_LabelWithProgress">
            <div className="label1">{label}</div>
            {progress == 100 ? (
                <Icon
                    icon="material:check_circle"
                    style={{ color: "green" }}
                    size={20}
                />
            ) : (
                <div className="progress1">
                    <progress id="file" value={progress} max="100" />
                    {Math.round(progress)} %
                </div>
            )}
        </div>
    );
}
