import * as React from "react";
import { CSSTransition } from "react-transition-group";
export { TransitionGroup } from "react-transition-group";

export const FADE_ENTRANCE_TRANSITION_DURATION = 500;

export class FadeEntranceTransition extends React.Component<any, {}> {
    render() {
        return (
            <CSSTransition
                {...this.props}
                classNames="EezStudio_FadeEntranceTransition"
                timeout={FADE_ENTRANCE_TRANSITION_DURATION}
            >
                {this.props.children}
            </CSSTransition>
        );
    }
}

export const BOUNCE_ENTRANCE_TRANSITION_DURATION = 750;

export class BounceEntranceTransition extends React.Component<any, {}> {
    render() {
        return (
            <CSSTransition
                {...this.props}
                classNames="EezStudio_BounceEntranceTransition"
                timeout={BOUNCE_ENTRANCE_TRANSITION_DURATION}
            >
                {this.props.children}
            </CSSTransition>
        );
    }
}
