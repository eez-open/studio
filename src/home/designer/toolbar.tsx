import * as React from "react";
import { observer } from "mobx-react";

import { IDocument, IToolbarButton } from "shared/ui/designer/designer-interfaces";
import { Toolbar } from "shared/ui/toolbar";
import { ButtonAction } from "shared/ui/action";

@observer
export class DesignerToolbar extends React.Component<
    {
        document: IDocument;
        buttons: IToolbarButton[];
    },
    {}
> {
    render() {
        return (
            <Toolbar className="EezStudio_ToolbarHeader">
                {this.props.buttons.map(button => (
                    <ButtonAction
                        key={button.id}
                        text={button.label}
                        title={button.title}
                        className={button.className}
                        onClick={() => button.onClick(this.props.document)}
                    />
                ))}
            </Toolbar>
        );
    }
}
