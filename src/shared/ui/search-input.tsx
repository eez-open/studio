import * as React from "react";
import * as classNames from "classnames";

import styled from "shared/ui/styled-components";

const Input = styled.input`
    padding: 2px 5px;
    width: 100%;
    border: none;
    &.empty {
        font-family: "Material Icons";
    }
`;

export class SearchInput extends React.Component<{
    searchText: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}> {
    render() {
        let className = classNames({
            empty: !this.props.searchText
        });

        return (
            <Input
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
