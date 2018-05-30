// import * as React from "react";
// import * as ReactDOM from "react-dom";
// import { observable, action } from "mobx";
// import { observer } from "mobx-react";
// import * as marked from "marked";

// import { doLayout } from "project-editor/core/layout";

// import * as Layout from "project-editor/components/Layout";

// ////////////////////////////////////////////////////////////////////////////////

// const QUICK_HELP_PAGE_NOT_DEFINED_TEXT =
//     "Ups! There is no quick help text defined for this section. To create help text, first click on quick help icon and then click on create (+) icon.";

// ////////////////////////////////////////////////////////////////////////////////

// type QuickHelpContentStatus = "unknown" | "found" | "not-found";

// interface PanelProps {
//     id: string;
//     title: JSX.Element | string;
//     buttons?: JSX.Element[];
//     body: JSX.Element | undefined;
// }

// interface PanelState {
//     quickHelpDetached?: boolean;
//     quickHelpContent?: string;
//     quickHelpContentStatus?: QuickHelpContentStatus;
// }

// @observer
// export class Panel extends React.Component<PanelProps, PanelState> {
//     refs: {
//         quickHelpIcon: HTMLDivElement;
//         quickHelp: Layout.SplitPanel;
//         body: Layout.Split;
//     };

//     @observable quickHelpDetached: boolean = true;
//     @observable quickHelpContent: string | undefined = undefined;
//     @observable quickHelpContentStatus: QuickHelpContentStatus = "unknown";

//     getQuickHelpContentUrl() {
//         return (
//             "https://raw.githubusercontent.com/eez-open/studio/master/help/en-US/quick/" +
//             this.props.id +
//             ".md"
//         );
//     }

//     getQuickHelpEditUrl() {
//         return (
//             "https://github.com/eez-open/studio/edit/master/help/en-US/quick/" +
//             this.props.id +
//             ".md"
//         );
//     }

//     getQuickHelpCreateUrl() {
//         return (
//             "https://github.com/eez-open/studio/new/master/help/en-US/quick/_?filename=" +
//             this.props.id +
//             ".md"
//         );
//     }

//     relayout() {
//         setTimeout(() => {
//             doLayout(ReactDOM.findDOMNode(this.refs.body) as HTMLElement, true);
//         });
//     }

//     componentDidMount() {
//         $(this.refs.quickHelpIcon).hover(
//             () => {
//                 if (this.quickHelpDetached) {
//                     $(ReactDOM.findDOMNode(this.refs.quickHelp) as Element).css(
//                         "visibility",
//                         "visible"
//                     );

//                     $.get(this.getQuickHelpContentUrl())
//                         .done(
//                             action((helpText: string) => {
//                                 this.quickHelpContent = marked(helpText);
//                                 this.quickHelpContentStatus = "found";
//                             })
//                         )
//                         .fail(
//                             action(() => {
//                                 this.quickHelpContent = marked(QUICK_HELP_PAGE_NOT_DEFINED_TEXT);
//                                 this.quickHelpContentStatus = "not-found";

//                                 this.relayout();
//                             })
//                         );
//                 }
//             },
//             () => {
//                 if (this.quickHelpDetached) {
//                     $(ReactDOM.findDOMNode(this.refs.quickHelp) as Element).css(
//                         "visibility",
//                         "hidden"
//                     );
//                 }
//             }
//         );

//         this.relayout();
//     }

//     componentDidUpdte() {
//         this.relayout();
//     }

//     @action
//     onClickQuickHelpIcon() {
//         this.quickHelpDetached = !this.quickHelpDetached;
//     }

//     onEditQuickHelp(event: any) {
//         event.preventDefault();
//         EEZStudio.electron.shell.openExternal(this.getQuickHelpEditUrl());
//     }

//     onCreateQuickHelp(event: any) {
//         event.preventDefault();
//         EEZStudio.electron.shell.openExternal(this.getQuickHelpCreateUrl());
//     }

//     render() {
//         let quickHelpEditLink: JSX.Element | undefined;
//         if (this.quickHelpContentStatus != "unknown" && !this.quickHelpDetached) {
//             let link: JSX.Element | undefined;
//             if (this.quickHelpContentStatus == "found") {
//                 // edit link
//                 link = (
//                     <a onClick={this.onEditQuickHelp.bind(this)} title="Edit">
//                         <span className="material-icons md-24">edit</span>
//                     </a>
//                 );
//             } else {
//                 // create link
//                 link = (
//                     <a onClick={this.onCreateQuickHelp.bind(this)} title="Create">
//                         <span className="material-icons md-24">add</span>
//                     </a>
//                 );
//             }
//             quickHelpEditLink = <div className="quick-help-edit-link">{link}</div>;
//         }

//         let quickHelpContent: JSX.Element | undefined;
//         if (this.quickHelpContentStatus != "unknown") {
//             quickHelpContent = (
//                 <div
//                     className="quick-help-content"
//                     dangerouslySetInnerHTML={{ __html: this.quickHelpContent || "" }}
//                 />
//             );
//         } else {
//             quickHelpContent = <div>Loading ...</div>;
//         }

//         let headerStyle: React.CSSProperties = {};
//         let title: JSX.Element;
//         if (typeof this.props.title == "string") {
//             title = <div className="EezStudio_ProjectEditor_PanelTitle">{this.props.title}</div>;
//         } else {
//             headerStyle.height = "auto";
//             title = this.props.title;
//         }

//         return (
//             <div className="EezStudio_ProjectEditor_Panel layoutCenter">
//                 <div className="EezStudio_ProjectEditor_PanelHeader layoutTop" style={headerStyle}>
//                     {title}
//                     <div className="btn-toolbar" role="toolbar">
//                         {this.props.buttons}
//                     </div>
//                     <div
//                         ref="quickHelpIcon"
//                         className="quick-help-icon"
//                         onClick={this.onClickQuickHelpIcon.bind(this)}
//                     >
//                         <span className="material-icons">help_outline</span>
//                     </div>
//                 </div>
//                 <Layout.Split
//                     ref="body"
//                     orientation="vertical"
//                     splitId={`${this.props.id}-panel-quick-help`}
//                     splitPosition="auto"
//                     className="EezStudio_ProjectEditor_PanelBody"
//                 >
//                     <Layout.SplitPanel
//                         ref="quickHelp"
//                         detached={this.quickHelpDetached}
//                         className="quick-help"
//                     >
//                         {quickHelpEditLink}
//                         {quickHelpContent}
//                     </Layout.SplitPanel>
//                     {this.props.body}
//                 </Layout.Split>
//             </div>
//         );
//     }
// }

import * as React from "react";
import { observer } from "mobx-react";

////////////////////////////////////////////////////////////////////////////////

interface PanelProps {
    id: string;
    title: JSX.Element | string;
    buttons?: JSX.Element[];
    body: JSX.Element | undefined;
}

@observer
export class Panel extends React.Component<PanelProps> {
    render() {
        let headerStyle: React.CSSProperties = {};
        let title: JSX.Element;
        if (typeof this.props.title == "string") {
            title = <div className="EezStudio_ProjectEditor_PanelTitle">{this.props.title}</div>;
        } else {
            headerStyle.height = "auto";
            title = this.props.title;
        }

        return (
            <div className="EezStudio_ProjectEditor_Panel layoutCenter">
                <div className="EezStudio_ProjectEditor_PanelHeader layoutTop" style={headerStyle}>
                    {title}
                    <div className="btn-toolbar" role="toolbar">
                        {this.props.buttons}
                    </div>
                </div>
                {this.props.body}
            </div>
        );
    }
}
