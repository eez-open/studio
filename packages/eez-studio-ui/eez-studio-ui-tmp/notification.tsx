import React from "react";

import { ToastContainer, toast, ToastPosition, UpdateOptions, ToastId } from "react-toastify";

export { ToastId } from "react-toastify";

export function info(message: string, options?: UpdateOptions) {
    return toast.info(message, options);
}

export function success(message: string, options?: UpdateOptions) {
    return toast.success(message, options);
}

export function warn(message: string, options?: UpdateOptions) {
    return toast.warn(message, options);
}

export function error(message: string, options?: UpdateOptions) {
    return toast.error(message, options);
}

export function update(toastId: ToastId, options: UpdateOptions) {
    return toast.update(toastId, options);
}

export function dismiss(toastId: number) {
    toast.dismiss(toastId);
}

export const container = (
    <ToastContainer
        position={ToastPosition.TOP_RIGHT}
        autoClose={5000}
        hideProgressBar={true}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
    />
);

export const INFO = toast.TYPE.INFO;
export const SUCCESS = toast.TYPE.SUCCESS;
export const WARNING = toast.TYPE.WARNING;
export const ERROR = toast.TYPE.ERROR;
