import * as React from 'react';

export class Loading extends React.Component<{
    size?:number;
}, {}> {
    render() {
        let size = this.props.size || 10;
        return (
            <div className="loader-container" style={{height: 8 * size}}>
                <div className="loader" style={{fontSize: size}}></div>
            </div>
        );
    }
}
