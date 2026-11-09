import React from "react";

// <audio> or <video> playing in-memory data, revokes its object URL when done
export function MediaPlayer({
    data,
    mimeType
}: {
    data: Uint8Array;
    mimeType: string;
}) {
    const src = React.useMemo(
        () =>
            URL.createObjectURL(
                new Blob([data as BufferSource], { type: mimeType })
            ),
        [data, mimeType]
    );

    React.useEffect(() => () => URL.revokeObjectURL(src), [src]);

    const props = {
        controls: true,
        src,
        draggable: true,
        onDragStart: (event: React.DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    return mimeType.startsWith("video") ? (
        <video {...props}></video>
    ) : (
        <audio {...props}></audio>
    );
}

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
