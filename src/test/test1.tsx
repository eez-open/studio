import * as React from "react";
import { observer } from "mobx-react";

import { _range } from "eez-studio-shared/algorithm";

@observer
export class ChildElement extends React.Component<{ num: number }> {
    render() {
        return <li>{this.props.num}</li>;
    }
}

@observer
export class Test1 extends React.Component {
    ulRef: React.RefObject<HTMLUListElement>;
    childRefs: React.RefObject<ChildElement>[] = [];

    constructor(props: any) {
        super(props);

        this.ulRef = React.createRef<HTMLUListElement>();
    }

    componentDidMount() {
        console.log(this.ulRef.current);
        this.childRefs.forEach(childRef => {
            console.log(childRef.current);
        });
    }

    getChildRef(i: number) {
        if (i >= this.childRefs.length) {
            this.childRefs[i] = React.createRef<ChildElement>();
        }
        return this.childRefs[i];
    }

    render() {
        return (
            <React.Fragment>
                <ul ref={this.ulRef}>
                    {_range(10).map(i => (
                        <ChildElement key={i} ref={this.getChildRef(i)} num={i} />
                    ))}
                </ul>
            </React.Fragment>
        );
    }
}
