import React from "react";

export function PreventDraggable(
    props: React.PropsWithChildren<{
        tag: keyof JSX.IntrinsicElements;
        className?: string;
    }>
) {
    return (
        <props.tag
            onMouseDown={(event: React.MouseEvent) => {
                $(event.currentTarget)
                    .closest(".EezStudio_HistoryItemEnclosure")
                    .attr("draggable", "false");
            }}
            onMouseUp={(event: React.MouseEvent) => {
                $(event.currentTarget)
                    .closest(".EezStudio_HistoryItemEnclosure")
                    .attr("draggable", "true");
            }}
            className={props.className}
        >
            {props.children}
        </props.tag>
    );
}
