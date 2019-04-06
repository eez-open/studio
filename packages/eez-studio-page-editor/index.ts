export { capitalize, humanize } from "eez-studio-shared/string";
export { Rect } from "eez-studio-shared/geometry";

export {
    EezObject,
    EezArrayObject,
    registerClass,
    PropertyType,
    ClassInfo,
    makeDerivedClassInfo,
    EezBrowsableObject,
    findClass,
    asArray,
    getProperty,
    objectToString,
    PropertyInfo,
    hidePropertiesInPropertyGrid,
    IPropertyGridGroupDefinition,
    dataGroup,
    geometryGroup,
    getAncestorOfType,
    isObjectExists
} from "eez-studio-shared/model/object";
export {
    getPropertyNames,
    TreeAdapter,
    TreeObjectAdapter
} from "eez-studio-shared/model/objectAdapter";
export { loadObject, objectToJson } from "eez-studio-shared/model/serialization";
export {
    DocumentStore,
    UndoManager,
    NavigationStore,
    addItem,
    deleteItem,
    UIElementsFactory,
    setUIElementsFactory,
    IUIElementsFactory,
    IMenuItemConfig,
    IMenu,
    IMenuItem,
    IMenuPopupOptions,
    IMenuAnchorPosition
} from "eez-studio-shared/model/store";
export { Message } from "eez-studio-shared/model/output";
export { validators } from "eez-studio-shared/model/validation";
export { PropertyProps } from "eez-studio-shared/model/components/PropertyGrid";
export { Tree } from "eez-studio-shared/model/components/Tree";
export { PropertyGrid } from "eez-studio-shared/model/components/PropertyGrid";
export { Panel } from "eez-studio-shared/model/components/Panel";

export { theme as styledComponentsTheme } from "eez-studio-ui/theme";
export { ThemeProvider } from "eez-studio-ui/styled-components";
export { Splitter } from "eez-studio-ui/splitter";
export { IconAction } from "eez-studio-ui/action";
export { IDialogComponentProps } from "eez-studio-ui/dialog";
export { showGenericDialog } from "eez-studio-ui/generic-dialog";
export { CodeEditor } from "eez-studio-ui/code-editor";

export { IResizeHandler } from "eez-studio-designer/designer-interfaces";
export { getObjectBoundingRectFromId } from "eez-studio-designer/bounding-rects";

export { PageEditor } from "eez-studio-page-editor/editor";
export {
    IDataContext,
    IDataItem,
    IPageContext,
    getPageContext,
    setPageContext
} from "eez-studio-page-editor/page-context";
export { Page } from "eez-studio-page-editor/page";
export {
    renderRootElement,
    WidgetComponent,
    WidgetContainerComponent
} from "eez-studio-page-editor/render";
export { resizingProperty } from "eez-studio-page-editor/resizing-widget-property";
export {
    getProperty as getResolutionDependableProperty
} from "eez-studio-page-editor/resolution-dependable-properties";
export {
    Widget,
    SelectWidget,
    makeDataPropertyInfo,
    makeActionPropertyInfo
} from "eez-studio-page-editor/widget";
export { WidgetPalette } from "eez-studio-page-editor/components/WidgetPalette";
export { setPageInitContext } from "eez-studio-page-editor/page-init-context";
