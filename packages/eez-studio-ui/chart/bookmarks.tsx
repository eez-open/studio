import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";

import { ChartBookmark, ChartsController } from "eez-studio-ui/chart/chart";

const BookmarksTableContainer = styled.div`
    background-color: white;
    overflow: auto;
    width: calc(100% - 20px);
    height: calc(100% - 20px);
    margin: 10px;
    padding: 10px;
    border: 1px solid ${props => props.theme.borderColor};

    table {
        width: 100%;

        tr {
            cursor: pointer;
            font-size: 90%;

            /* &:nth-child(2n+1) {
                background-color: ${props => props.theme.borderColor};
            } */

            &.selected {
                background-color: ${props =>
                    props.theme.selectionBackgroundColor};
                color: white;
            }

            td:nth-child(1),
            td:nth-child(2) {
                padding-right: 10px;
            }

            td:nth-child(3) {
                width: 100%;
            }
        }
    }
`;

@observer
export class Bookmark extends React.Component<{
    chartsController: ChartsController;
    index: number;
    bookmark: ChartBookmark;
    selected: boolean;
    onClick: () => void;
}> {
    render() {
        const {
            chartsController,
            index,
            bookmark,
            selected,
            onClick
        } = this.props;

        let className = classNames({
            selected
        });

        const xAxisController = chartsController.xAxisController;
        const time = bookmark.value;

        const timeStr = xAxisController.axisModel.unit.formatValue(
            xAxisController.axisModel.semiLogarithmic
                ? Math.pow(
                      10,
                      time + xAxisController.axisModel.semiLogarithmic.a
                  ) + xAxisController.axisModel.semiLogarithmic.b
                : time,
            4
        );

        return (
            <tr className={className} onClick={onClick}>
                <td>{index}.</td>
                <td>{timeStr}</td>
                <td>{bookmark.text}</td>
            </tr>
        );
    }
}

@observer
export class BookmarksView extends React.Component<{
    chartsController: ChartsController;
}> {
    div: HTMLElement;

    ensureVisible() {
        const selectedRow = $(this.div).find("tr.selected")[0];
        if (selectedRow) {
            (selectedRow as any).scrollIntoViewIfNeeded();
        }
    }

    componentDidMount() {
        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    render() {
        const { chartsController } = this.props;

        if (!chartsController.bookmarks) {
            return null;
        }

        return (
            <BookmarksTableContainer ref={ref => (this.div = ref!)}>
                <table>
                    <tbody>
                        {chartsController.bookmarks.map((bookmark, i) => (
                            <Bookmark
                                key={i}
                                chartsController={chartsController}
                                index={i + 1}
                                bookmark={bookmark}
                                selected={
                                    i == chartsController.selectedBookmark
                                }
                                onClick={() =>
                                    chartsController.selectBookmark(i)
                                }
                            />
                        ))}
                    </tbody>
                </table>
            </BookmarksTableContainer>
        );
    }
}
