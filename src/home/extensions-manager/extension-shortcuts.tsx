import * as React from "react";
import { observable, computed } from "mobx";
import { observer } from "mobx-react";

import { IShortcut } from "shortcuts/interfaces";
import { Shortcuts } from "shortcuts/shortcuts";

import { IExtension } from "eez-studio-shared/extensions/extension";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ExtensionShortcuts extends React.Component<{ extension: IExtension }, {}> {
    @computed
    get shortcutsStore() {
        const shortcuts = this.props.extension.properties!.shortcuts!;
        let shortcutsMap = new Map<string, IShortcut>();
        shortcuts.forEach(shortcut => shortcutsMap.set(shortcut.id, shortcut));
        return {
            shortcuts: observable.map(shortcutsMap)
        };
    }

    render() {
        return <Shortcuts shortcutsStore={this.shortcutsStore} />;
    }
}
