#include <stdio.h>
#include <eez/core/sound.h>

#include <eez/gui/keypad.h>
#include <eez/gui/widgets/display_data.h>
#include <eez/gui/widgets/input.h>

#include <eez/flow/flow.h>

#include "keypad.h"

namespace eez {
namespace gui {

static NumericKeypad g_numericKeypad;
static Keypad g_textKeyboard;

static Keypad *g_activeKeypad;

NumericKeypad *startNumericKeypad(
	AppContext *appContext,
	const char *label,
	const Value &value,
	NumericKeypadOptions &options,
	void(*okFloat)(float),
	void(*okUint32)(uint32_t),
	void(*cancel)()
) {
	g_activeKeypad = &g_numericKeypad;
	g_numericKeypad.init(appContext, label, value, options, okFloat, okUint32, cancel);
	appContext->pushPage(options.pageId, &g_numericKeypad);
	return &g_numericKeypad;
}

void startTextKeyboard(const char *label, const char *text, int minChars_, int maxChars_, bool isPassword_, void(*ok)(char *), void(*cancel)(), void(*setDefault)()) {
    auto appContext = getAppContextFromId(APP_CONTEXT_ID_DEVICE);
	g_activeKeypad = &g_textKeyboard;
	g_textKeyboard.start(appContext, label, text, minChars_, maxChars_, isPassword_, ok, cancel, setDefault);
	appContext->pushPage(PAGE_ID_KEYBOARD, &g_textKeyboard);
}

void executeNumericKeypadOptionHook(int optionActionIndex) {
}

Keypad *getActiveKeypad() {
    return g_activeKeypad;
}

NumericKeypad *getActiveNumericKeypad() {
    auto appContext = getAppContextFromId(APP_CONTEXT_ID_DEVICE);
    if (appContext->getActivePageId() == PAGE_ID_NUMERIC_KEYPAD) {
        return &g_numericKeypad;
    }
    return nullptr;
}

WidgetCursor g_editWidgetCursor;

void keypadSetFloatValue(float value) {
	auto &widgetCursor = g_editWidgetCursor;
	// auto dataId = flow::getNativeVariableId(widgetCursor);
	// if (dataId == DATA_ID_INTENSITY) {
	// 	auto unit = getUnit(widgetCursor, widgetCursor.widget->data);
	// 	set(widgetCursor, widgetCursor.widget->data, Value(value, unit));
	// } else if (dataId == DATA_ID_DURATION) {
	// 	set(widgetCursor, widgetCursor.widget->data, (int)value);
	// }
    auto unit = getUnit(widgetCursor, widgetCursor.widget->data);
    set(widgetCursor, widgetCursor.widget->data, Value(value, unit));
    auto appContext = getAppContextFromId(APP_CONTEXT_ID_DEVICE);
	appContext->popPage();
}

void textKeyboardSet(char *value) {
	auto &widgetCursor = g_editWidgetCursor;
	set(widgetCursor, widgetCursor.widget->data, value);
    auto appContext = getAppContextFromId(APP_CONTEXT_ID_DEVICE);
	appContext->popPage();
}

void action_edit() {
    auto widgetCursor = getFoundWidgetAtDown();
	auto widget = (const InputWidget*)widgetCursor.widget;

	auto data = widgetCursor.widget->data;

	auto value = eez::gui::get(widgetCursor, data);
	auto minValue = eez::gui::getMin(widgetCursor, data);
	auto maxValue = eez::gui::getMax(widgetCursor, data);

	g_editWidgetCursor = widgetCursor;

	if (widget->flags & INPUT_WIDGET_TYPE_NUMBER) {
		auto defValue = eez::gui::getDef(widgetCursor, data);

		NumericKeypadOptions options;

		options.pageId = PAGE_ID_NUMERIC_KEYPAD;

		options.min = minValue.getFloat();
		options.max = maxValue.getFloat();

		// auto dataId = flow::getNativeVariableId(widgetCursor);
		// if (dataId == DATA_ID_INTENSITY) {
		// 	options.editValueUnit = value.getUnit();
		// 	options.flags.dotButtonEnabled = true;
		// }
        options.editValueUnit = value.getUnit();
		options.flags.dotButtonEnabled = true;

        auto appContext = getAppContextFromId(APP_CONTEXT_ID_DEVICE);
		startNumericKeypad(appContext, nullptr, value, options, keypadSetFloatValue, nullptr, nullptr);
	} else {
		startTextKeyboard(nullptr, value.getString(), minValue.toInt32(), maxValue.toInt32(), widget->flags & INPUT_WIDGET_PASSWORD_FLAG, textKeyboardSet, nullptr, nullptr);
	}
}

void showKeyboard(Value label, Value initialText, Value minChars, Value maxChars, bool isPassword, void(*onOk)(char *), void(*onCancel)()) {
	eez::gui::startTextKeyboard(label.getString(), initialText.getString(), minChars.toInt32(), maxChars.toInt32(), isPassword, onOk, onCancel, nullptr);
}

void showKeypad(Value label, Value initialValue, Value min, Value max, Unit unit, void(*onOk)(float), void(*onCancel)()) {
	NumericKeypadOptions options;
	options.pageId = PAGE_ID_NUMERIC_KEYPAD;
	options.min = min.toFloat();
	options.max = max.toFloat();
	options.editValueUnit = unit;
    options.flags.dotButtonEnabled = initialValue.isFloat() || initialValue.isDouble();
    options.flags.unitChangeEnabled = false;

    auto appContext = getAppContextFromId(APP_CONTEXT_ID_DEVICE);
	eez::gui::startNumericKeypad(appContext, label.getString(), initialValue, options, onOk, nullptr, onCancel);
}

} // gui
} // eez
