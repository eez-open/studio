import React from "react";
import { makeObservable, observable, runInAction } from "mobx";
import { observer } from "mobx-react";

export function makeLazyComponent<T, U>(
    load: (props: U) => Promise<T>,
    render: (lazyData: T, props: U) => React.ReactNode,
    dispose?: (lazyData: T | undefined) => void
) {
    return observer(
        class SessionInfoContainer extends React.Component<U> {
            lazyData: T | undefined;

            constructor(props: U) {
                super(props);

                makeObservable(this, {
                    lazyData: observable.shallow
                });

                this.load(props);
            }

            async load(props: U) {
                const lazyData = await load(props);
                runInAction(() => {
                    this.lazyData = lazyData;
                });
            }

            componentWillUnmount(): void {
                if (dispose) {
                    dispose(this.lazyData);
                }
            }

            render() {
                if (!this.lazyData) {
                    return null;
                }

                return render(this.lazyData, this.props);
            }
        }
    );
}
