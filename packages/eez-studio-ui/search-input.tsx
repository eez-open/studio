import React from "react";
import classNames from "classnames";

export class SearchInput extends React.Component<{
    searchText: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}> {
    render() {
        let className = classNames("EezStudio_SearchInput", {
            empty: !this.props.searchText
        });

        return (
            <input
                type="text"
                placeholder="&#xe8b6;"
                className={className}
                value={this.props.searchText}
                onChange={this.props.onChange}
                onKeyDown={this.props.onKeyDown}
            />
        );
    }
}
