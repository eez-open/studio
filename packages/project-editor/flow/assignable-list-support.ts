// Only these project families use the full EEZ Flow reference container.
// EEZ GUI Lite inherits isFirmware, so exclude its separate engine explicitly.
export function supportsAssignableLists(traits: {
    hasFlowSupport: boolean;
    isFirmware: boolean;
    isDashboard: boolean;
    isLVGL: boolean;
    isEezFlowLite: boolean;
}): boolean {
    return (
        traits.hasFlowSupport &&
        !traits.isEezFlowLite &&
        (traits.isFirmware || traits.isDashboard || traits.isLVGL)
    );
}

export const ASSIGNABLE_LIST_RUNTIME_ERROR =
    "Assignable lists require the full EEZ Flow runtime (EEZ-GUI, Dashboard or LVGL with Flow); EEZ Flow Lite is not supported.";
