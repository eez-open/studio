import React from "react";
import { observable, runInAction } from "mobx";

import { ToastContainer, toast, ToastPosition, UpdateOptions } from "react-toastify";

// lazy notifications, i.e. do not load react-toastify module until needed

function getToast() {
    runInAction(() => {
        container.set(
            <ToastContainer
                position={ToastPosition.TOP_RIGHT}
                autoClose={5000}
                hideProgressBar={true}
                newestOnTop={false}
                closeOnClick
                pauseOnHover
            />
        );
    });

    return toast;
}

export function info(message: string, options?: UpdateOptions) {
    return getToast().info(message, options);
}

export function success(message: string, options?: UpdateOptions) {
    return getToast().success(message, options);
}

export function warn(message: string, options?: UpdateOptions) {
    return getToast().warn(message, options);
}

export function error(message: string, options?: UpdateOptions) {
    return getToast().error(message, options);
}

export function update(toastId: number, options: UpdateOptions) {
    return getToast().update(toastId, options);
}

export function dismiss(toastId: number) {
    getToast().dismiss(toastId);
}

export const container = observable.box<JSX.Element | undefined>(undefined, { deep: false });

export const INFO = toast.TYPE.INFO;
export const SUCCESS = toast.TYPE.SUCCESS;
export const WARNING = toast.TYPE.WARNING;
export const ERROR = toast.TYPE.ERROR;
