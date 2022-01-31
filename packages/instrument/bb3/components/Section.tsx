import React from "react";
import { observer } from "mobx-react";

export const Section = observer(
    ({
        title,
        titleControls,
        body
    }: {
        title: React.ReactNode;
        titleControls?: React.ReactNode;
        body: React.ReactNode;
    }) => {
        return (
            <section
                className="shadow-sm rounded bg-light bg-gradient"
                style={{ overflow: "auto" }}
            >
                <header className="EezStudio_BB3_SectionHeaderContainer">
                    <div>
                        <h4 className="text-truncate">{title}</h4>
                    </div>
                    {titleControls}
                </header>
                <div className="EezStudio_BB3_SectionBody">{body}</div>
            </section>
        );
    }
);
