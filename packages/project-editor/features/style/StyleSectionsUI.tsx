import React from "react";
import { observable, runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import {
    findPropertyByNameInClassInfo,
    getClassInfo,
    PropertyInfo,
    PropertyProps
} from "project-editor/core/object";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";
import { PropertyMenu } from "project-editor/ui-components/PropertyGrid/PropertyMenu";
import { ThemedColorInput } from "project-editor/ui-components/PropertyGrid/ThemedColorInput";
import {
    getPropertyValue,
    isPropertyInError
} from "project-editor/ui-components/PropertyGrid/utils";

////////////////////////////////////////////////////////////////////////////////

// In EEZ-GUI projects the properties of a style are shown in sections (Text,
// Background, ...), a row of a section has one or more properties. A property
// with a value for each side (or corner) has an editor for the sides.

type StyleFieldKind =
    | "default"
    | "sides"
    | "corners"
    | "colorSides"
    | "alignHorizontal"
    | "alignVertical";

interface IStyleField {
    name: string;
    // the label in front of the field (if the row has more than one field)
    label?: string;
    title?: string;
    kind?: StyleFieldKind;
}

interface IStyleRow {
    label: string;
    fields: IStyleField[];
}

interface IStyleSection {
    title: string;
    rows: IStyleRow[];
}

// the name of the section property in the Style class -> the section
export const STYLE_SECTIONS: { [name: string]: IStyleSection } = {
    textStyleSection: {
        title: "Text",
        rows: [
            { label: "Font", fields: [{ name: "font" }] },
            {
                label: "Align",
                fields: [
                    { name: "alignHorizontal", kind: "alignHorizontal" },
                    { name: "alignVertical", kind: "alignVertical" }
                ]
            },
            { label: "Color", fields: [{ name: "color" }] },
            {
                label: "Spacing",
                fields: [
                    {
                        name: "letterSpacing",
                        label: "Letter",
                        title: "Letter spacing"
                    },
                    {
                        name: "lineHeight",
                        label: "Line",
                        title: "Line height (0: the line height of the font)"
                    }
                ]
            },
            { label: "Ellipsis", fields: [{ name: "ellipsis" }] }
        ]
    },
    backgroundStyleSection: {
        title: "Background",
        rows: [
            { label: "Color", fields: [{ name: "backgroundColor" }] },
            { label: "Image", fields: [{ name: "backgroundImage" }] }
        ]
    },
    borderStyleSection: {
        title: "Border and padding",
        rows: [
            {
                label: "Border size",
                fields: [{ name: "borderSize", kind: "sides" }]
            },
            {
                label: "Border radius",
                fields: [{ name: "borderRadius", kind: "corners" }]
            },
            {
                label: "Border color",
                fields: [{ name: "borderColor", kind: "colorSides" }]
            },
            { label: "Padding", fields: [{ name: "padding", kind: "sides" }] }
        ]
    },
    effectsStyleSection: {
        title: "Effects",
        rows: [
            { label: "Opacity", fields: [{ name: "opacity" }] },
            { label: "Blink", fields: [{ name: "blink" }] }
        ]
    },
    shadowStyleSection: {
        title: "Shadow",
        rows: [
            {
                label: "Offset",
                fields: [
                    { name: "shadowOffsetX", label: "X", title: "Offset X" },
                    { name: "shadowOffsetY", label: "Y", title: "Offset Y" }
                ]
            },
            {
                label: "Size",
                fields: [
                    { name: "shadowBlur", label: "Blur" },
                    { name: "shadowSpread", label: "Spread" }
                ]
            },
            { label: "Color", fields: [{ name: "shadowColor" }] }
        ]
    },
    focusRingStyleSection: {
        title: "Focus ring",
        rows: [
            {
                label: "Size",
                fields: [
                    { name: "focusRingWidth", label: "Width" },
                    { name: "focusRingOffset", label: "Offset" }
                ]
            },
            { label: "Color", fields: [{ name: "focusRingColor" }] }
        ]
    }
};

////////////////////////////////////////////////////////////////////////////////

// CSS shorthand of the four sides (top, right, bottom, left) or corners (top
// left, top right, bottom right, bottom left): one value for all, two for
// top/bottom and right/left, three for top, right/left and bottom.

function splitValues(value: any, isColor: boolean) {
    if (typeof value == "number") {
        return [value.toString()];
    }
    if (typeof value != "string") {
        return undefined;
    }
    const parts = value
        .trim()
        .split(isColor ? /\s+/ : /[\s,]+/)
        .filter(part => part.length > 0);
    return parts.length > 0 ? parts : undefined;
}

function expandValues(parts: string[] | undefined) {
    if (!parts) {
        return undefined;
    }
    if (parts.length == 1) {
        return [parts[0], parts[0], parts[0], parts[0]];
    }
    if (parts.length == 2) {
        return [parts[0], parts[1], parts[0], parts[1]];
    }
    if (parts.length == 3) {
        return [parts[0], parts[1], parts[2], parts[1]];
    }
    if (parts.length == 4) {
        return parts;
    }
    return undefined;
}

function compressValues(values: string[]) {
    const [a, b, c, d] = values;
    if (a == b && a == c && a == d) {
        return a;
    }
    if (a == c && b == d) {
        return `${a} ${b}`;
    }
    if (b == d) {
        return `${a} ${b} ${c}`;
    }
    return `${a} ${b} ${c} ${d}`;
}

const SIDE_LABELS = [
    { label: "T", title: "Top" },
    { label: "R", title: "Right" },
    { label: "B", title: "Bottom" },
    { label: "L", title: "Left" }
];

const CORNER_LABELS = [
    { label: "TL", title: "Top left" },
    { label: "TR", title: "Top right" },
    { label: "BR", title: "Bottom right" },
    { label: "BL", title: "Bottom left" }
];

// the properties with the editor of the sides opened by the user (or closed:
// false), it is opened by default if the sides have different values
const sidesEditorOpened = observable.map<string, boolean>();

////////////////////////////////////////////////////////////////////////////////

const SIDES_ICON = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
            d="M4 2.5h8M13.5 4v8M4 13.5h8M2.5 4v8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
);

const CORNERS_ICON = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
            d="M2.5 6.5v-1a3 3 0 0 1 3-3h1M9.5 2.5h1a3 3 0 0 1 3 3v1M13.5 9.5v1a3 3 0 0 1-3 3h-1M6.5 13.5h-1a3 3 0 0 1-3-3v-1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
);

const ALIGN_ITEMS: {
    [name: string]: { id: string; title: string; icon: React.ReactNode }[];
} = {
    alignHorizontal: [
        {
            id: "left",
            title: "Left",
            icon: <path d="M2.5 4h11M2.5 8h7M2.5 12h9" />
        },
        {
            id: "center",
            title: "Center",
            icon: <path d="M2.5 4h11M4.5 8h7M3.5 12h9" />
        },
        {
            id: "right",
            title: "Right",
            icon: <path d="M2.5 4h11M6.5 8h7M4.5 12h9" />
        }
    ],
    alignVertical: [
        {
            id: "top",
            title: "Top",
            icon: <path d="M2.5 2.5h11M8 5v8M5.5 7.5 8 5l2.5 2.5" />
        },
        {
            id: "center",
            title: "Center",
            icon: <path d="M2.5 8h11M8 2.5v3M8 10.5v3" />
        },
        {
            id: "bottom",
            title: "Bottom",
            icon: <path d="M2.5 13.5h11M8 3v8M5.5 8.5 8 11l2.5-2.5" />
        }
    ]
};

////////////////////////////////////////////////////////////////////////////////

export const StyleSectionUI = observer(
    class StyleSectionUI extends React.Component<PropertyProps> {
        get section() {
            return STYLE_SECTIONS[this.props.propertyInfo.name];
        }

        getPropertyInfo(name: string) {
            return findPropertyByNameInClassInfo(
                getClassInfo(this.props.objects[0]),
                name
            )!;
        }

        render() {
            const section = this.section;
            if (!section) {
                return null;
            }

            return (
                <div className="EezStudio_StyleSection">
                    <div className="EezStudio_StyleSection_Title">
                        {section.title}
                    </div>
                    {section.rows.map(row => (
                        <StyleSectionRow
                            key={row.label}
                            row={row}
                            getPropertyInfo={name => this.getPropertyInfo(name)}
                            {...this.props}
                        />
                    ))}
                </div>
            );
        }
    }
);

const StyleSectionRow = observer(
    class StyleSectionRow extends React.Component<
        PropertyProps & {
            row: IStyleRow;
            getPropertyInfo: (name: string) => PropertyInfo;
        }
    > {
        render() {
            const { row } = this.props;

            // the editor of the sides (only one field in such a row)
            const sidesField = row.fields.find(
                field =>
                    field.kind == "sides" ||
                    field.kind == "corners" ||
                    field.kind == "colorSides"
            );

            const sidesEditor = sidesField && (
                <SidesEditor
                    {...this.props}
                    propertyInfo={this.props.getPropertyInfo(sidesField.name)}
                    kind={sidesField.kind as SidesKind}
                />
            );

            return (
                <div className="EezStudio_StyleSection_Row">
                    <div className="EezStudio_StyleSection_RowLine">
                        <div
                            className="EezStudio_StyleSection_RowLabel"
                            title={row.label}
                        >
                            {row.label}
                        </div>
                        <div className="EezStudio_StyleSection_Fields">
                            {row.fields.map(field => (
                                <StyleField
                                    key={field.name}
                                    {...this.props}
                                    field={field}
                                    propertyInfo={this.props.getPropertyInfo(
                                        field.name
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                    {sidesEditor}
                </div>
            );
        }
    }
);

function isPropertyMenuShown(props: PropertyProps) {
    if (props.readOnly) {
        return false;
    }

    if (
        props.objects.find(
            object => !getClassInfo(object).isPropertyMenuSupported
        )
    ) {
        return false;
    }

    return (
        !!props.propertyInfo.inheritable ||
        (!!props.propertyInfo.propertyMenu &&
            props.propertyInfo.propertyMenu(props).length > 0)
    );
}

const StyleField = observer(
    class StyleField extends React.Component<
        PropertyProps & { field: IStyleField }
    > {
        render() {
            const { field, propertyInfo, objects } = this.props;

            const propertyProps: PropertyProps = {
                propertyInfo,
                objects,
                updateObject: this.props.updateObject,
                readOnly: this.props.readOnly
            };

            const inError =
                objects.length == 1 && isPropertyInError(objects[0], propertyInfo);

            let editor;
            if (
                field.kind == "alignHorizontal" ||
                field.kind == "alignVertical"
            ) {
                editor = <AlignButtons {...propertyProps} />;
            } else {
                editor = <Property {...propertyProps} />;
            }

            let sidesToggle;
            if (
                field.kind == "sides" ||
                field.kind == "corners" ||
                field.kind == "colorSides"
            ) {
                sidesToggle = <SidesToggle {...propertyProps} kind={field.kind} />;
            }

            return (
                <div
                    className={classNames("EezStudio_StyleSection_Field", {
                        inError
                    })}
                    title={field.title}
                >
                    {field.label && (
                        <div className="EezStudio_StyleSection_FieldLabel">
                            {field.label}
                        </div>
                    )}
                    <div className="EezStudio_StyleSection_FieldValue">
                        {editor}
                    </div>
                    {sidesToggle}
                    {isPropertyMenuShown(propertyProps) && (
                        <PropertyMenu {...propertyProps} />
                    )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const AlignButtons = observer(
    class AlignButtons extends React.Component<PropertyProps> {
        render() {
            const { propertyInfo, objects } = this.props;
            const value = getPropertyValue(objects, propertyInfo)?.value;

            return (
                <div className="EezStudio_StyleSection_AlignButtons btn-group">
                    {ALIGN_ITEMS[propertyInfo.name].map(item => (
                        <button
                            key={item.id}
                            type="button"
                            className={classNames(
                                "btn btn-sm btn-outline-secondary",
                                { active: value == item.id }
                            )}
                            title={item.title}
                            disabled={this.props.readOnly}
                            onClick={() =>
                                this.props.updateObject({
                                    [propertyInfo.name]: item.id
                                })
                            }
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                {item.icon}
                            </svg>
                        </button>
                    ))}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

type SidesKind = "sides" | "corners" | "colorSides";

function getSidesState(props: PropertyProps, kind: SidesKind) {
    const value = getPropertyValue(props.objects, props.propertyInfo)?.value;

    // an elliptical border radius ("x radii / y radii") is edited as text
    const isElliptical = typeof value == "string" && value.includes("/");

    const values = isElliptical
        ? undefined
        : expandValues(splitValues(value, kind == "colorSides"));

    const differentValues =
        values != undefined && values.some(value => value != values[0]);

    const opened =
        values != undefined &&
        (sidesEditorOpened.get(props.propertyInfo.name) ?? differentValues);

    return { value, isElliptical, values, opened };
}

const SidesToggle = observer(
    class SidesToggle extends React.Component<
        PropertyProps & { kind: SidesKind }
    > {
        render() {
            const { kind, propertyInfo } = this.props;
            const { isElliptical, values, opened } = getSidesState(
                this.props,
                kind
            );

            const what = kind == "corners" ? "corner" : "side";

            const title = isElliptical
                ? "An elliptical radius (x radii / y radii) is edited as text"
                : values
                ? `A value for each ${what}`
                : this.props.objects.length > 1
                ? "Different values in the selected objects"
                : `Set a value first, then a value for each ${what}`;

            return (
                <button
                    type="button"
                    className={classNames(
                        "EezStudio_StyleSection_SidesToggle btn btn-sm btn-outline-secondary",
                        { active: opened }
                    )}
                    title={title}
                    disabled={values == undefined}
                    onClick={() =>
                        runInAction(() =>
                            sidesEditorOpened.set(propertyInfo.name, !opened)
                        )
                    }
                >
                    {kind == "corners" ? CORNERS_ICON : SIDES_ICON}
                </button>
            );
        }
    }
);

const SidesEditor = observer(
    class SidesEditor extends React.Component<
        PropertyProps & { kind: SidesKind }
    > {
        setValue(index: number, newValue: string) {
            const { values } = getSidesState(this.props, this.props.kind);
            if (!values) {
                return;
            }
            const newValues = [...values];
            newValues[index] = newValue;
            this.props.updateObject({
                [this.props.propertyInfo.name]: compressValues(newValues)
            });
        }

        render() {
            const { kind, readOnly } = this.props;
            const { values, opened } = getSidesState(this.props, kind);

            if (!values || !opened) {
                return null;
            }

            const labels = kind == "corners" ? CORNER_LABELS : SIDE_LABELS;

            return (
                <div
                    className={classNames("EezStudio_StyleSection_Sides", {
                        colors: kind == "colorSides"
                    })}
                >
                    {labels.map((label, index) => (
                        <div
                            key={label.label}
                            className="EezStudio_StyleSection_Side"
                            title={label.title}
                        >
                            <div className="EezStudio_StyleSection_FieldLabel">
                                {label.label}
                            </div>
                            <div className="EezStudio_StyleSection_FieldValue">
                                {kind == "colorSides" ? (
                                    <ThemedColorInput
                                        value={values[index]}
                                        onChange={newValue =>
                                            this.setValue(index, newValue)
                                        }
                                        readOnly={readOnly}
                                    />
                                ) : (
                                    <SideNumberInput
                                        value={values[index]}
                                        onChange={newValue =>
                                            this.setValue(index, newValue)
                                        }
                                        readOnly={readOnly}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
    }
);

// the value is set while typing, but only when it is a number
class SideNumberInput extends React.Component<
    {
        value: string;
        onChange: (value: string) => void;
        readOnly: boolean;
    },
    { text: string | undefined }
> {
    state = { text: undefined as string | undefined };

    render() {
        return (
            <input
                type="text"
                className="form-control"
                value={this.state.text ?? this.props.value}
                readOnly={this.props.readOnly}
                onChange={event => {
                    const text = event.target.value;
                    this.setState({ text });
                    if (/^\s*\d+\s*$/.test(text)) {
                        this.props.onChange(text.trim());
                    }
                }}
                onBlur={() => this.setState({ text: undefined })}
            />
        );
    }
}
