import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";

import { loadObject } from "project-editor/core/object";
import { objectToClipboardData, setClipboardData } from "project-editor/core/clipboard";
import { DragAndDropManager } from "project-editor/core/dd";

import { getPages } from "project-editor/project/features/gui/gui";
import { Page } from "project-editor/project/features/gui/page";
import { Storyboard, StoryboardPage } from "project-editor/project/features/gui/storyboard";

////////////////////////////////////////////////////////////////////////////////

const PageDiv = styled.div`
    cursor: -webkit-grab;
    border: 2px solid transparent;

    &:hover {
        background-color: ${props => props.theme.hoverBackgroundColor};
        color: ${props => props.theme.hoverColor};
    }

    &.selected {
        background-color: ${props => props.theme.selectionBackgroundColor};
        color: ${props => props.theme.selectionColor};
    }

    &.dragging {
        background-color: ${props => props.theme.dragSourceBackgroundColor};
        color: ${props => props.theme.dragSourceColor};
    }
`;

class PageProps {
    page: Page;
    selected: boolean;
    onSelect: () => void;
}

class PageState {
    dragging: boolean;
}

@observer
class PageComponent extends React.Component<PageProps, PageState> {
    constructor(props: PageProps) {
        super(props);
        this.state = {
            dragging: false
        };
    }

    onDragStart(event: any) {
        this.props.onSelect();

        this.setState({
            dragging: true
        });

        let object = loadObject(
            undefined,
            {
                x: 0,
                y: 0,
                page: this.props.page.name
            },
            StoryboardPage
        );

        setClipboardData(event, objectToClipboardData(object));

        event.dataTransfer.effectAllowed = "copy";

        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);
    }

    onDragEnd() {
        this.setState({
            dragging: false
        });
    }

    render() {
        let className = classNames({
            selected: this.props.selected,
            dragging: this.state.dragging
        });

        return (
            <PageDiv
                className={className}
                onClick={this.props.onSelect}
                draggable={true}
                onDragStart={this.onDragStart.bind(this)}
                onDragEnd={this.onDragEnd.bind(this)}
            >
                {this.props.page.name}
            </PageDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const PagesPaletteDiv = styled.div`
    overflow: auto;
`;

interface PagesPaletteProps {
    storyboard: Storyboard;
}

interface PagesPaletteState {
    selectedPage: Page | undefined;
}

@observer
export class PagesPalette extends React.Component<PagesPaletteProps, PagesPaletteState> {
    constructor(props: PagesPaletteProps) {
        super(props);
        this.state = {
            selectedPage: undefined
        };
    }

    getMissingPages() {
        return getPages()._array.filter(page => {
            return !this.props.storyboard.pages._array.find(storyboardPage => {
                return (storyboardPage as StoryboardPage).page == page.name;
            });
        });
    }

    onSelect(page: Page) {
        this.setState({
            selectedPage: page
        });
    }

    render() {
        let pages = this.getMissingPages().map(page => {
            return (
                <PageComponent
                    key={page.name}
                    page={page}
                    onSelect={this.onSelect.bind(this, page)}
                    selected={page == this.state.selectedPage}
                />
            );
        });

        return <PagesPaletteDiv tabIndex={0}>{pages}</PagesPaletteDiv>;
    }
}
