// EEZ BB3+ in the instrument window: the views of the data BB3+ sends over
// its push port (eez-bb3plus-cm5-firmware/src/bb3/push/push_protocol.h): the
// samples of the sampled module fields (Scope), the module fields and the
// debug log.
//
// React and mobx only where the views meet the rest of Studio (the
// navigation items, the instrument connection), the views are plain DOM.

import React from "react";
import { untracked } from "mobx";

import type { InstrumentAppStore } from "instrument/window/app-store";
import type { INavigationItem } from "instrument/window/navigation";

import { BB3PlusInstrument } from "instrument/bb3plus/BB3PlusInstrument";
import { ICONS, BB3PlusView } from "instrument/bb3plus/components/dom";
import { ScopeView } from "instrument/bb3plus/components/ScopeView";
import { FieldsView } from "instrument/bb3plus/components/FieldsView";
import { DebugLogView } from "instrument/bb3plus/components/DebugLogView";

const bb3PlusInstruments = new Map<string, BB3PlusInstrument>();

export function getBB3PlusInstrument(
    appStore: InstrumentAppStore,
    create: boolean
) {
    if (!appStore.instrument) {
        return undefined;
    }
    let bb3PlusInstrument = bb3PlusInstruments.get(appStore.instrument.id);
    if (!bb3PlusInstrument && create) {
        const instrument = appStore.instrument;
        // created in a reaction or a render, it isn't part of them
        bb3PlusInstrument = untracked(() => new BB3PlusInstrument(instrument));
        bb3PlusInstruments.set(instrument.id, bb3PlusInstrument);
    }
    return bb3PlusInstrument;
}

export function terminateBB3PlusInstrument(instrumentId: string) {
    const bb3PlusInstrument = bb3PlusInstruments.get(instrumentId);
    if (bb3PlusInstrument) {
        bb3PlusInstrument.terminate();
        bb3PlusInstruments.delete(instrumentId);
    }
}

type ViewClass = new (bb3PlusInstrument: BB3PlusInstrument) => BB3PlusView;

// the plain DOM view in the React tree of Studio: made when mounted,
// destroyed when unmounted
class ViewHost extends React.Component<{
    appStore: InstrumentAppStore;
    View: ViewClass;
}> {
    ref = React.createRef<HTMLDivElement>();
    view: BB3PlusView | undefined;

    componentDidMount() {
        const bb3PlusInstrument = getBB3PlusInstrument(
            this.props.appStore,
            true
        );
        if (bb3PlusInstrument && this.ref.current) {
            this.view = new this.props.View(bb3PlusInstrument);
            this.ref.current.appendChild(this.view.element);
            this.view.mounted();
        }
    }

    componentWillUnmount() {
        this.view?.destroy();
        this.view = undefined;
    }

    shouldComponentUpdate() {
        return false;
    }

    render() {
        return <div ref={this.ref} className="EezStudio_BB3Plus_Host" />;
    }
}

// an icon of ICONS for the navigation: the svg element itself, Icon of
// Studio sets its size and class
function createNavIcon(path: string) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d={path} />
        </svg>
    );
}

function createNavigationItem(
    appStore: InstrumentAppStore,
    id: string,
    icon: string,
    title: string,
    View: ViewClass
): INavigationItem {
    return {
        id,
        icon: createNavIcon(icon),
        title,
        // the key: another item is another view
        renderContent: () => (
            <ViewHost key={id} appStore={appStore} View={View} />
        ),
        renderToolbarButtons: () => <div />
    };
}

export function createNavigationItems(
    appStore: InstrumentAppStore
): INavigationItem[] {
    return [
        createNavigationItem(
            appStore,
            "bb3plus-scope",
            ICONS.scope,
            "Scope",
            ScopeView
        ),
        createNavigationItem(
            appStore,
            "bb3plus-fields",
            ICONS.fields,
            "Module Fields",
            FieldsView
        ),
        createNavigationItem(
            appStore,
            "bb3plus-debug-log",
            ICONS.debugLog,
            "Debug Log",
            DebugLogView
        )
    ];
}
