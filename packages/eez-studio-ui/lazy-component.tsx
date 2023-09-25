import React from "react";
import { makeObservable, observable, runInAction } from "mobx";
import { observer } from "mobx-react";

export function makeLazyComponent<T>(
    load: () => Promise<T>,
    render: (lazyData: T) => React.ReactNode
) {
    return observer(
        class SessionInfoContainer extends React.Component {
            lazyData: T | undefined;

            constructor(props: any) {
                super(props);

                makeObservable(this, {
                    lazyData: observable.shallow
                });

                this.load();
            }

            async load() {
                const lazyData = await load();
                runInAction(() => {
                    this.lazyData = lazyData;
                });
            }

            render() {
                if (!this.lazyData) {
                    return null;
                }

                return render(this.lazyData);
            }
        }
    );
}
