import React from "react";
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
                    position={ToastModule.ToastPosition.TOP_RIGHT}
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

export function info(message: string, options?: ToastModule.UpdateOptions) {
    return getToast().info(message, options);
}

export function success(message: string, options?: ToastModule.UpdateOptions) {
    return getToast().success(message, options);
}

export function warn(message: string, options?: ToastModule.UpdateOptions) {
    return getToast().warn(message, options);
}

export function error(message: string, options?: ToastModule.UpdateOptions) {
    return getToast().error(message, options);
}

export function update(toastId: number, options: ToastModule.UpdateOptions) {
    return getToast().update(toastId, options);
}

export const container = observable.box<JSX.Element | undefined>(undefined, { deep: false });

export const INFO = ToastModule.toast.TYPE.INFO;
export const SUCCESS = ToastModule.toast.TYPE.SUCCESS;
export const WARNING = ToastModule.toast.TYPE.WARNING;
export const ERROR = ToastModule.toast.TYPE.ERROR;
