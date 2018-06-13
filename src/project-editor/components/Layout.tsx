import * as React from 'react';

function combineClassNames(...classNames: (string | undefined)[]) {
    let className: string|undefined;

    for (let i = 0; i < classNames.length; i++) {
        if (classNames[i]) {
            if (className) {
                className += ' ' + classNames[i];
            } else {
                className = classNames[i];
            }
        }
    }

    return className;
}

// class Div extends React.Component<{
//     className?: string;
//     style?: React.CSSProperties
//     tabIndex?: number;
//     onFocus?: React.EventHandler<React.FocusEvent<HTMLElement>>;
//     onKeyDown?: React.EventHandler<React.KeyboardEvent<HTMLElement>>;
// }, {}> {
//     protected getClassName(): string | undefined { 
//         return undefined;
//     }
    
//     protected getStyle(): React.CSSProperties | undefined {
//         return undefined;
//     }

//     render () {
//         let style = this.getStyle();
//         if (style) {
//             if (this.props.style) {
//                 style = Object.assign({}, style, this.props.style);
//             }
//         } else {
//             style = this.props.style;
//         }

//         return (
//             <div
//                 className={combineClassNames(this.getClassName(), this.props.className, 'layoutInner')}
//                 tabIndex={this.props.tabIndex}
//                 onFocus={this.props.onFocus}
//                 onKeyDown={this.props.onKeyDown}
//                 style={style}
//             >
//                 {this.props.children}
//             </div>
//         );
//     }
// }

// export class Column extends Div {
//     getClassName() {
//         return "layoutCenter";
//     }

//     getStyle(): React.CSSProperties {
//         return {
//             display: 'flex',
//             flexDirection: 'column'
//         };  
//     }
// }

// export class Item extends Div {
// }

// export class FlexItem extends Div {
//     getStyle(): React.CSSProperties {
//         return {
//             display: 'flex',
//             flexGrow: 1
//         };  
//     }
// }

interface SplitProps {
    orientation: 'horizontal'|'vertical';
    splitId: string;
    splitPosition?: string|number;

    className?: string;
    tabIndex?: number;
    onFocus?: React.EventHandler<React.FocusEvent<HTMLElement>>;
}

export class Split extends React.Component<SplitProps, {}> {
    public static defaultProps: Partial<SplitProps> = {
        splitPosition: 0.5
    };

    render() {
        let childClassName = this.props.orientation == 'horizontal' ? 'layoutSplitHorizontal' : 'layoutSplitVertical';

        let children = React.Children.map(this.props.children, (child: any, i) => {
            if (child) {
                if (child.type === SplitPanel) {
                    let props: Partial<SplitPanelProps> = {
                        className: combineClassNames(child.props.className, childClassName)
                    };

                    if (i == 0) {
                        props.splitId = this.props.splitId;
                        props.splitPosition = this.props.splitPosition;
                    }

                    return React.cloneElement(child, props);
                } else {
                    if (i == 0) {
                        return (
                            <div className={childClassName} data-splitter-id={this.props.splitId} data-splitter-position={this.props.splitPosition}>
                                {child}
                            </div>
                        );
                    } else {
                        return (
                            <div className={childClassName}>
                                {child}
                            </div>
                        );
                    }
                }
            } else {
                return null;
            }
        });

        return (
            <div 
                className={combineClassNames(this.props.className, "layoutCenter")}
                tabIndex={this.props.tabIndex}
                onFocus={this.props.onFocus}
            >
                {children}
            </div>
        );
    }
}

interface SplitPanelProps {
    detached?: boolean;
    splitId?: string;
    splitPosition?: string|number;

    className?: string;
    tabIndex?: number;
    onFocus?: React.EventHandler<React.FocusEvent<HTMLElement>>;
}

export class SplitPanel extends React.Component<SplitPanelProps, {}> {
    public static defaultProps: Partial<SplitPanelProps> = {
        detached: false
    };

    render() {
        return (
            <div 
                className={combineClassNames(this.props.className, this.props.detached ? 'layoutDetached' : undefined)}
                data-splitter-id={this.props.splitId}
                data-splitter-position={this.props.splitPosition}
            >
                {this.props.children}
            </div>
        );
    }
}
