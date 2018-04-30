import * as React from "react";
import { observable, runInAction } from "mobx";

import * as ToastModule from "react-toastify";

// lazy notifications, i.e. do not load react-toastify module until needed

let toastModule: typeof ToastModule | undefined = undefined;

function getToast() {
    if (!toastModule) {
        toastModule = require("react-toastify") as typeof ToastModule;

        const ToastContainer = toastModule.ToastContainer;
        runInAction(() => {
            container.set(
                <ToastContainer
                    position="top-right"
                    autoClose={5000}
                    hideProgressBar={true}
                    newestOnTop={false}
                    closeOnClick
                    pauseOnHover
                />
            );
        });
    }

    return toastModule.toast;
}

export function info(message: string) {
    getToast().info(message);
}

export function success(message: string) {
    getToast().success(message);
}

export function error(message: string) {
    getToast().error(message);
}

export const container = observable.box<JSX.Element | undefined>(undefined, { deep: false });
