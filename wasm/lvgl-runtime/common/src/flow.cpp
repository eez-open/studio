#include <stdio.h>
#include <vector>
#include <map>
#include <emscripten.h>

#include <eez/core/os.h>
#include <eez/core/assets.h>
#include <eez/core/action.h>
#include <eez/core/vars.h>
#include <eez/core/util.h>

#include <eez/flow/flow.h>
#include <eez/flow/expression.h>
#include <eez/flow/hooks.h>
#include <eez/flow/debugger.h>
#include <eez/flow/components.h>
#include <eez/flow/flow_defs_v3.h>
#include <eez/flow/operations.h>
#include <eez/flow/lvgl_api.h>
#include <eez/flow/date.h>

#include "flow.h"

////////////////////////////////////////////////////////////////////////////////

bool is_editor = false;
bool g_screensLifetimeSupport = false;

uint32_t screenLoad_animType = 0;
uint32_t screenLoad_speed = 0;
uint32_t screenLoad_delay = 0;

////////////////////////////////////////////////////////////////////////////////

#define WIDGET_TIMELINE_PROPERTY_X (1 << 0)
#define WIDGET_TIMELINE_PROPERTY_Y (1 << 1)
#define WIDGET_TIMELINE_PROPERTY_WIDTH (1 << 2)
#define WIDGET_TIMELINE_PROPERTY_HEIGHT (1 << 3)
#define WIDGET_TIMELINE_PROPERTY_OPACITY (1 << 4)
#define WIDGET_TIMELINE_PROPERTY_SCALE (1 << 5)
#define WIDGET_TIMELINE_PROPERTY_ROTATE (1 << 6)
#define WIDGET_TIMELINE_PROPERTY_CP1 (1 << 7)
#define WIDGET_TIMELINE_PROPERTY_CP2 (1 << 8)

#define EASING_FUNC_LINEAR 0
#define EASING_FUNC_IN_QUAD 1
#define EASING_FUNC_OUT_QUAD 2
#define EASING_FUNC_IN_OUT_QUAD 3
#define EASING_FUNC_IN_CUBIC 4
#define EASING_FUNC_OUT_CUBIC 5
#define EASING_FUNC_IN_OUT_CUBIC 6
#define EASING_FUNC_IN__QUART 7
#define EASING_FUNC_OUT_QUART 8
#define EASING_FUNC_IN_OUT_QUART 9
#define EASING_FUNC_IN_QUINT 10
#define EASING_FUNC_OUT_QUINT 11
#define EASING_FUNC_IN_OUT_QUINT 12
#define EASING_FUNC_IN_SINE 13
#define EASING_FUNC_OUT_SINE 14
#define EASING_FUNC_IN_OUT_SINE 15
#define EASING_FUNC_IN_EXPO 16
#define EASING_FUNC_OUT_EXPO 17
#define EASING_FUNC_IN_OUT_EXPO 18
#define EASING_FUNC_IN_CIRC 19
#define EASING_FUNC_OUT_CIRC 20
#define EASING_FUNC_IN_OUT_CIRC 21
#define EASING_FUNC_IN_BACK 22
#define EASING_FUNC_OUT_BACK 23
#define EASING_FUNC_IN_OUT_BACK 24
#define EASING_FUNC_IN_ELASTIC 25
#define EASING_FUNC_OUT_ELASTIC 26
#define EASING_FUNC_IN_OUT_ELASTIC 27
#define EASING_FUNC_IN_BOUNCE 28
#define EASING_FUNC_OUT_BOUNCE 29
#define EASING_FUNC_IN_OUT_BOUNCE 30

struct TimelineKeyframe {
    float start;
    float end;

    uint32_t enabledProperties;

	int16_t x;
    uint8_t xEasingFunc;

	int16_t y;
    uint8_t yEasingFunc;

	int16_t width;
    uint8_t widthEasingFunc;

	int16_t height;
    uint8_t heightEasingFunc;

    float opacity;
    uint8_t opacityEasingFunc;

    int16_t scale;
    uint8_t scaleEasingFunc;

    int16_t rotate;
    uint8_t rotateEasingFunc;

    int32_t cp1x;
    int32_t cp1y;
    int32_t cp2x;
    int32_t cp2y;
};

struct WidgetTimeline {
    lv_obj_t *obj;
    void *flowState;

    float lastTimelinePosition;

	int16_t x;
	int16_t y;
	int16_t width;
	int16_t height;
    int16_t opacity;
    int16_t scale;
    int16_t rotate;

    std::vector<TimelineKeyframe> timeline;
};

std::vector<WidgetTimeline> widgetTimelines;

void addTimelineKeyframe(
    lv_obj_t *obj,
    void *flowState,
    float start, float end,
    uint32_t enabledProperties,
    int16_t x, uint8_t xEasingFunc,
    int16_t y, uint8_t yEasingFunc,
    int16_t width, uint8_t widthEasingFunc,
    int16_t height, uint8_t heightEasingFunc,
    int16_t opacity, uint8_t opacityEasingFunc,
    int16_t scale, uint8_t scaleEasingFunc,
    int16_t rotate, uint8_t rotateEasingFunc,
    int32_t cp1x, int32_t cp1y, int32_t cp2x, int32_t cp2y
) {
    TimelineKeyframe timelineKeyframe;

    timelineKeyframe.start = start;
    timelineKeyframe.end = end;

    timelineKeyframe.enabledProperties = enabledProperties;

	timelineKeyframe.x = x;
    timelineKeyframe.xEasingFunc = xEasingFunc;

	timelineKeyframe.y = y;
    timelineKeyframe.yEasingFunc = yEasingFunc;

	timelineKeyframe.width = width;
    timelineKeyframe.widthEasingFunc = widthEasingFunc;

	timelineKeyframe.height = height;
    timelineKeyframe.heightEasingFunc = heightEasingFunc;

    timelineKeyframe.opacity = opacity;
    timelineKeyframe.opacityEasingFunc = opacityEasingFunc;

    timelineKeyframe.scale = scale;
    timelineKeyframe.scaleEasingFunc = scaleEasingFunc;

    timelineKeyframe.rotate = rotate;
    timelineKeyframe.rotateEasingFunc = rotateEasingFunc;

    timelineKeyframe.cp1x = cp1x;
    timelineKeyframe.cp1y = cp1y;
    timelineKeyframe.cp2x = cp2x;
    timelineKeyframe.cp2y = cp2y;

    for (auto it = widgetTimelines.begin(); it != widgetTimelines.end(); it++) {
        WidgetTimeline &widgetTimeline = *it;
        if (widgetTimeline.obj == obj) {
            widgetTimeline.timeline.push_back(timelineKeyframe);
            return;
        }
    }

    WidgetTimeline widgetTimeline;
    widgetTimeline.obj = obj;
    widgetTimeline.lastTimelinePosition = -1;
    widgetTimeline.flowState = flowState;

    widgetTimeline.timeline.push_back(timelineKeyframe);

    widgetTimelines.push_back(widgetTimeline);
}

void updateTimelineProperties(WidgetTimeline &widgetTimeline, float timelinePosition) {
    if (widgetTimeline.lastTimelinePosition == -1) {
        widgetTimeline.x = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_X).num;
        widgetTimeline.y = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_Y).num;
        widgetTimeline.width = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_WIDTH).num;
        widgetTimeline.height = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_HEIGHT).num;
        widgetTimeline.opacity = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_OPA).num / 255.0f;

#if LVGL_VERSION_MAJOR >= 9
        // TODO LVGL 9.0
        widgetTimeline.scale = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_TRANSFORM_SCALE_X).num;
        widgetTimeline.rotate = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_TRANSFORM_ROTATION).num;
#else
        widgetTimeline.scale = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_TRANSFORM_ZOOM).num;
        widgetTimeline.rotate = lv_obj_get_style_prop(widgetTimeline.obj, LV_PART_MAIN, LV_STYLE_TRANSFORM_ANGLE).num;
#endif

        widgetTimeline.lastTimelinePosition = 0;
    }

    if (timelinePosition == widgetTimeline.lastTimelinePosition) {
        return;
    }

    widgetTimeline.lastTimelinePosition = timelinePosition;

    float x = widgetTimeline.x;
    float y = widgetTimeline.y;
    float w = widgetTimeline.width;
    float h = widgetTimeline.height;
    float opacity = widgetTimeline.opacity;
    float scale = widgetTimeline.scale;
    float rotate = widgetTimeline.rotate;

    for (auto itKeyframe = widgetTimeline.timeline.begin(); itKeyframe != widgetTimeline.timeline.end(); itKeyframe++) {
        TimelineKeyframe &keyframe = *itKeyframe;

        if (timelinePosition < keyframe.start) {
            continue;
        }

        if (timelinePosition >= keyframe.start && timelinePosition <= keyframe.end) {
            auto t =
                keyframe.start == keyframe.end
                    ? 1
                    : (timelinePosition - keyframe.start) /
                    (keyframe.end - keyframe.start);

            if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_X) {
                auto t2 = eez::g_easingFuncs[keyframe.xEasingFunc](t);

                if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_CP2) {
                    auto p1 = x;
                    auto p2 = keyframe.cp1x;
                    auto p3 = keyframe.cp2x;
                    auto p4 = keyframe.x;
                    x =
                        (1 - t2) * (1 - t2) * (1 - t2) * p1 +
                        3 * (1 - t2) * (1 - t2) * t2 * p2 +
                        3 * (1 - t2) * t2 * t2 * p3 +
                        t2 * t2 * t2 * p4;
                } else if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_CP1) {
                    auto p1 = x;
                    auto p2 = keyframe.cp1x;
                    auto p3 = keyframe.x;
                    x =
                        (1 - t2) * (1 - t2) * p1 +
                        2 * (1 - t2) * t2 * p2 +
                        t2 * t2 * p3;
                } else {
                    auto p1 = x;
                    auto p2 = keyframe.x;
                    x = (1 - t2) * p1 + t2 * p2;
                }
            }

            if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_WIDTH) {
                w += eez::g_easingFuncs[keyframe.widthEasingFunc](t) * (keyframe.width - w);
            }

            if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_Y) {
                auto t2 = eez::g_easingFuncs[keyframe.yEasingFunc](t);

                if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_CP2) {
                    auto p1 = y;
                    auto p2 = keyframe.cp1y;
                    auto p3 = keyframe.cp2y;
                    auto p4 = keyframe.y;
                    y =
                        (1 - t2) * (1 - t2) * (1 - t2) * p1 +
                        3 * (1 - t2) * (1 - t2) * t2 * p2 +
                        3 * (1 - t2) * t2 * t2 * p3 +
                        t2 * t2 * t2 * p4;
                } else if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_CP1) {
                    auto p1 = y;
                    auto p2 = keyframe.cp1y;
                    auto p3 = keyframe.y;
                    y =
                        (1 - t2) * (1 - t2) * p1 +
                        2 * (1 - t2) * t2 * p2 +
                        t2 * t2 * p3;
                } else {
                    auto p1 = y;
                    auto p2 = keyframe.y;
                    y = (1 - t2) * p1 + t2 * p2;
                }
            }

            if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_HEIGHT) {
                h += eez::g_easingFuncs[keyframe.heightEasingFunc](t) * (keyframe.height - h);
            }

            if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_OPACITY) {
                opacity += eez::g_easingFuncs[keyframe.opacityEasingFunc](t) * (keyframe.opacity - opacity);
            }

            if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_SCALE) {
                scale += eez::g_easingFuncs[keyframe.scaleEasingFunc](t) * (keyframe.scale - scale);
            }

            if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_ROTATE) {
                rotate += eez::g_easingFuncs[keyframe.rotateEasingFunc](t) * (keyframe.rotate - rotate);
            }

            break;
        }

        if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_X) {
            x = keyframe.x;
        }
        if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_Y) {
            y = keyframe.y;
        }
        if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_WIDTH) {
            w = keyframe.width;
        }
        if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_HEIGHT) {
            h = keyframe.height;
        }

        if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_OPACITY) {
            opacity = keyframe.opacity;
        }

        if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_SCALE) {
            scale = keyframe.scale;
        }

        if (keyframe.enabledProperties & WIDGET_TIMELINE_PROPERTY_ROTATE) {
            rotate = keyframe.rotate;
        }
    }

    lv_style_value_t value;

    value.num = (int32_t)roundf(x);
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_X, value, LV_PART_MAIN);

    value.num = (int32_t)roundf(y);
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_Y, value, LV_PART_MAIN);

    value.num = (int32_t)roundf(w);
    if (value.num != -1) {
        lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_WIDTH, value, LV_PART_MAIN);
    }

    value.num = (int32_t)roundf(h);
    if (value.num != -1) {
        lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_HEIGHT, value, LV_PART_MAIN);
    }

    value.num = (int32_t)roundf(opacity * 255.0f);
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_OPA, value, LV_PART_MAIN);

    value.num = (int32_t)roundf(scale);
#if LVGL_VERSION_MAJOR >= 9
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_TRANSFORM_SCALE_X, value, LV_PART_MAIN);
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_TRANSFORM_SCALE_Y, value, LV_PART_MAIN);
#else
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_TRANSFORM_ZOOM, value, LV_PART_MAIN);
#endif

    value.num = (int32_t)roundf(rotate);
#if LVGL_VERSION_MAJOR >= 9
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_TRANSFORM_ROTATION, value, LV_PART_MAIN);
#else
    lv_obj_set_local_style_prop(widgetTimeline.obj, LV_STYLE_TRANSFORM_ANGLE, value, LV_PART_MAIN);
#endif
}

void doAnimateFlowState(eez::flow::FlowState *flowState) {
    for (auto it = widgetTimelines.begin(); it != widgetTimelines.end(); it++) {
        WidgetTimeline &widgetTimeline = *it;
        if (widgetTimeline.flowState == flowState) {
            updateTimelineProperties(widgetTimeline, flowState->timelinePosition);
        }
    }

    for (auto childFlowState = flowState->firstChild; childFlowState; childFlowState = childFlowState->nextSibling) {
        doAnimateFlowState(childFlowState);
    }
}

void doAnimate() {
    if (g_currentScreen != -1) {
        auto flowState = eez::flow::getPageFlowState(eez::g_mainAssets, g_currentScreen);
        doAnimateFlowState(flowState);
    }
}

void setTimelinePosition(float timelinePosition) {
    for (auto it = widgetTimelines.begin(); it != widgetTimelines.end(); it++) {
        WidgetTimeline &widgetTimeline = *it;
        updateTimelineProperties(widgetTimeline, timelinePosition);
    }
}

void clearTimeline() {
    widgetTimelines.clear();
}

////////////////////////////////////////////////////////////////////////////////

struct UpdateTask {
    UpdateTaskType updateTaskType;
    lv_obj_t *obj;
    void *flow_state;
    unsigned component_index;
    unsigned property_index;
    void *subobj;
    int param;
};

static UpdateTask *g_updateTask;

#if LVGL_VERSION_MAJOR >= 9
#else
#define lv_event_get_target_obj lv_event_get_target
#endif

void flow_event_callback(lv_event_t *e) {
    FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
    e->user_data = (void *)data->user_data;
    flowPropagateValueLVGLEvent(data->flow_state, data->component_index, data->output_or_property_index, e);
}

void flow_event_checked_state_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target_obj(e);
        if (!g_updateTask || g_updateTask->obj != ta) {
            FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
            bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
            assignBooleanProperty(data->flow_state, data->component_index, data->output_or_property_index, value, "Failed to assign Checked state");
        }
    }
}


void flow_event_checked_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    lv_obj_t *ta = lv_event_get_target_obj(e);
    if (event == LV_EVENT_VALUE_CHANGED && lv_obj_has_state(ta, LV_STATE_CHECKED)) {
        flow_event_callback(e);
    }
}

void flow_event_unchecked_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    lv_obj_t *ta = lv_event_get_target_obj(e);
    if (event == LV_EVENT_VALUE_CHANGED && !lv_obj_has_state(ta, LV_STATE_CHECKED)) {
        flow_event_callback(e);
    }
}
#if LVGL_VERSION_MAJOR >= 9
void flow_event_meter_tick_label_event_callback(lv_event_t *e) {
    // TODO LVGL 9.0
}
#else
void flow_event_meter_tick_label_event_callback(lv_event_t *e) {
    lv_obj_draw_part_dsc_t * draw_part_dsc = lv_event_get_draw_part_dsc(e);

    // Be sure it's drawing meter related parts
    if (draw_part_dsc->class_p != &lv_meter_class) return;

    // Be sure it's drawing the ticks
    if (draw_part_dsc->type != LV_METER_DRAW_PART_TICK) return;

    g_eezFlowLvlgMeterTickIndex = draw_part_dsc->id;
    FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
    const char *temp = evalTextProperty(data->flow_state, data->component_index, data->output_or_property_index, "Failed to evalute scale label in Meter widget");
    if (temp) {
        static char label[32];
        strncpy(label, temp, sizeof(label));
        label[sizeof(label) - 1] = 0;
        draw_part_dsc->text = label;
        draw_part_dsc->text_length = sizeof(label);
    }
}
#endif

void flow_event_callback_delete_user_data(lv_event_t *e) {
#if LVGL_VERSION_MAJOR >= 9
    lv_free(e->user_data);
#else
    lv_mem_free(e->user_data);
#endif
}

////////////////////////////////////////////////////////////////////////////////

std::vector<UpdateTask> updateTasks;

void addUpdateTask(UpdateTaskType updateTaskType, lv_obj_t *obj, void *flow_state, unsigned component_index, unsigned property_index, void *subobj, int param) {
    UpdateTask updateTask;
    updateTask.updateTaskType = updateTaskType;
    updateTask.obj = obj;
    updateTask.flow_state = flow_state;
    updateTask.component_index = component_index;
    updateTask.property_index = property_index;
    updateTask.subobj = subobj;
    updateTask.param = param;
    updateTasks.push_back(updateTask);
}

void doUpdateTasks() {
    for (auto it = updateTasks.begin(); it != updateTasks.end(); it++) {
        UpdateTask &updateTask = *it;
        
        g_updateTask = &updateTask;
        if (updateTask.updateTaskType == UPDATE_TASK_TYPE_CHECKED_STATE) {
            bool new_val = evalBooleanProperty(updateTask.flow_state, updateTask.component_index, updateTask.property_index, "Failed to evaluate Checked state");
            bool cur_val = lv_obj_has_state(updateTask.obj, LV_STATE_CHECKED);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_state(updateTask.obj, LV_STATE_CHECKED);
                else lv_obj_clear_state(updateTask.obj, LV_STATE_CHECKED);
            }
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_DISABLED_STATE) {
            bool new_val = evalBooleanProperty(updateTask.flow_state, updateTask.component_index, updateTask.property_index, "Failed to evaluate Disabled state");
            bool cur_val = lv_obj_has_state(updateTask.obj, LV_STATE_DISABLED);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_state(updateTask.obj, LV_STATE_DISABLED);
                else lv_obj_clear_state(updateTask.obj, LV_STATE_DISABLED);
            }
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_HIDDEN_FLAG) {
            bool new_val = evalBooleanProperty(updateTask.flow_state, updateTask.component_index, updateTask.property_index, "Failed to evaluate Hidden flag");
            bool cur_val = lv_obj_has_flag(updateTask.obj, LV_OBJ_FLAG_HIDDEN);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_flag(updateTask.obj, LV_OBJ_FLAG_HIDDEN);
                else lv_obj_clear_flag(updateTask.obj, LV_OBJ_FLAG_HIDDEN);
            }
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_CLICKABLE_FLAG) {
            bool new_val = evalBooleanProperty(updateTask.flow_state, updateTask.component_index, updateTask.property_index, "Failed to evaluate Clickable flag");
            bool cur_val = lv_obj_has_flag(updateTask.obj, LV_OBJ_FLAG_CLICKABLE);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_flag(updateTask.obj, LV_OBJ_FLAG_CLICKABLE);
                else lv_obj_clear_flag(updateTask.obj, LV_OBJ_FLAG_CLICKABLE);
            }
        }
        g_updateTask = nullptr;
    }
}

////////////////////////////////////////////////////////////////////////////////

void startToDebuggerMessage() {
    EM_ASM({
        startToDebuggerMessage($0);
    }, eez::flow::g_wasmModuleId);
}

static char g_debuggerBuffer[1024 * 1024];
static uint32_t g_debuggerBufferIndex = 0;

void writeDebuggerBuffer(const char *buffer, uint32_t length) {
    if (g_debuggerBufferIndex + length > sizeof(g_debuggerBuffer)) {
        EM_ASM({
            writeDebuggerBuffer($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2));
        }, eez::flow::g_wasmModuleId, g_debuggerBuffer, g_debuggerBufferIndex);
        g_debuggerBufferIndex = 0;
    } else {
        memcpy(g_debuggerBuffer + g_debuggerBufferIndex, buffer, length);
        g_debuggerBufferIndex += length;
    }
}

void finishToDebuggerMessage() {
    if (g_debuggerBufferIndex > 0) {
        EM_ASM({
            writeDebuggerBuffer($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2));
        }, eez::flow::g_wasmModuleId, g_debuggerBuffer, g_debuggerBufferIndex);
        g_debuggerBufferIndex = 0;
    }

    EM_ASM({
        finishToDebuggerMessage($0);
    }, eez::flow::g_wasmModuleId);
}

void replacePageHook(int16_t pageId, uint32_t animType, uint32_t speed, uint32_t delay) {
    eez_flow_create_screen(pageId);

    screenLoad_animType = animType;
    screenLoad_speed = speed;
    screenLoad_delay = delay;
    eez::flow::onPageChanged(g_currentScreen + 1, pageId);
    g_currentScreen = pageId - 1;
}

EM_PORT_API(void) stopScript() {
    eez::flow::stop();
}

EM_PORT_API(void) onMessageFromDebugger(char *messageData, uint32_t messageDataSize) {
    eez::flow::processDebuggerInput(messageData, messageDataSize);
}

EM_PORT_API(void *) lvglGetFlowState(void *flowState, unsigned userWidgetComponentIndexOrPageIndex) {
    return getFlowState(flowState, userWidgetComponentIndexOrPageIndex);
}

EM_PORT_API(void) setDebuggerMessageSubsciptionFilter(uint32_t filter) {
    eez::flow::setDebuggerMessageSubsciptionFilter(filter);
}

////////////////////////////////////////////////////////////////////////////////

static std::map<int, lv_obj_t *> indexToObject;

extern "C" void setObjectIndex(lv_obj_t *obj, int32_t index) {
    indexToObject.insert(std::make_pair(index, obj));
}

void deleteObjectIndex(int32_t index) {
    auto it = indexToObject.find(index);
    if (it != indexToObject.end()) {
        auto obj = it->second;

        updateTasks.erase(
            std::remove_if(
                updateTasks.begin(), 
                updateTasks.end(),
                [obj](const UpdateTask& updateTask) { 
                    return updateTask.obj == obj;
                }
            ),
            updateTasks.end()
        );

        indexToObject.erase(it);
    }
}

EM_PORT_API(lv_obj_t *) getLvglObjectFromIndex(int32_t index) {
    auto it = indexToObject.find(index);
    if (it == indexToObject.end()) {
        return nullptr;
    }
    return it->second;
}

////////////////////////////////////////////////////////////////////////////////

static std::vector<lv_group_t *> groups;
static std::map<lv_obj_t *, std::map<lv_group_t *, std::vector<lv_obj_t *>>> screenToGroupObjects;

void screen_loaded_event_callback(lv_event_t *e) {
    lv_obj_t *screenObj = lv_event_get_target_obj(e);

    for (auto itGroups = groups.begin(); itGroups != groups.end(); itGroups++) {
        auto groupObj = *itGroups;

        lv_group_remove_all_objs(groupObj);

        auto itScreenToGroupObjects = screenToGroupObjects.find(screenObj);
        if (itScreenToGroupObjects != screenToGroupObjects.end()) {
            auto itGroupObjects = itScreenToGroupObjects->second.find(groupObj);
            if (itGroupObjects != itScreenToGroupObjects->second.end()) {
                std::vector<lv_obj_t *> &groupObjects = itGroupObjects->second;
                for (auto itObjects = groupObjects.begin(); itObjects != groupObjects.end(); itObjects++) {
                    lv_group_add_obj(groupObj, *itObjects);
                }
            }
        }
    }
}

EM_PORT_API(lv_group_t *) lvglCreateGroup() {
    lv_group_t *group = lv_group_create();
    groups.push_back(group);
    return group;
}

EM_PORT_API(void) lvglAddScreenLoadedEventHandler(lv_obj_t *screenObj) {
     lv_obj_add_event_cb(screenObj, screen_loaded_event_callback, LV_EVENT_SCREEN_LOAD_START, 0);
}

EM_PORT_API(void) lvglGroupAddObject(lv_obj_t *screenObj, lv_group_t *groupObj, lv_obj_t *obj) {
    auto itScreenToGroupObjects = screenToGroupObjects.find(screenObj);

    if (itScreenToGroupObjects == screenToGroupObjects.end()) {
        std::vector<lv_obj_t *> groupObjects;
        groupObjects.push_back(obj);

        std::map<lv_group_t *, std::vector<lv_obj_t *>> groupMap;
        groupMap.insert(std::make_pair(groupObj, groupObjects));

        screenToGroupObjects.insert(std::make_pair(screenObj, groupMap));
        return;
    }

    auto itGroupObjects = itScreenToGroupObjects->second.find(groupObj);
    if (itGroupObjects == itScreenToGroupObjects->second.end()) {
        std::vector<lv_obj_t *> groupObjects;
        groupObjects.push_back(obj);

        itScreenToGroupObjects->second.insert(std::make_pair(groupObj, groupObjects));
        return;
    }

    std::vector<lv_obj_t *> &groupObjects = itGroupObjects->second;
    groupObjects.push_back(obj);
}

EM_PORT_API(void) lvglGroupRemoveObjectsForScreen(lv_obj_t *screenObj) {
    auto itScreenToGroupObjects = screenToGroupObjects.find(screenObj);
    if (itScreenToGroupObjects != screenToGroupObjects.end()) {
        screenToGroupObjects.erase(itScreenToGroupObjects);
    }
}

static lv_group_t *getLvglGroupFromIndex(int32_t index) {
    if (index >= 0 && index < groups.size()) {
        return groups[index];
    }
    return 0;
}

////////////////////////////////////////////////////////////////////////////////

static int32_t getLvglScreenByName(const char *name) {
    return (int32_t)EM_ASM_INT({
        return getLvglScreenByName($0, UTF8ToString($1));
    }, eez::flow::g_wasmModuleId, name);
}

static int32_t getLvglObjectByName(const char *name) {
    return (int32_t)EM_ASM_INT({
        return getLvglObjectByName($0, UTF8ToString($1));
    }, eez::flow::g_wasmModuleId, name);
}

static int32_t getLvglGroupByName(const char *name) {
    return (int32_t)EM_ASM_INT({
        return getLvglGroupByName($0, UTF8ToString($1));
    }, eez::flow::g_wasmModuleId, name);
}

static int32_t getLvglStyleByName(const char *name) {
    return (int32_t)EM_ASM_INT({
        return getLvglStyleByName($0, UTF8ToString($1));
    }, eez::flow::g_wasmModuleId, name);
}

static const void *getLvglImageByName(const char *name) {
    return (const void *)EM_ASM_INT({
        return getLvglImageByName($0, UTF8ToString($1));
    }, eez::flow::g_wasmModuleId, name);
}

////////////////////////////////////////////////////////////////////////////////

static void lvglObjAddStyle(lv_obj_t *obj, int32_t styleIndex) {
    EM_ASM({
        lvglObjAddStyle($0, $1, $2);
    }, eez::flow::g_wasmModuleId, obj, styleIndex);
}

static void lvglObjRemoveStyle(lv_obj_t *obj, int32_t styleIndex) {
    EM_ASM({
        lvglObjRemoveStyle($0, $1, $2);
    }, eez::flow::g_wasmModuleId, obj, styleIndex);
}

////////////////////////////////////////////////////////////////////////////////

static void lvglSetColorTheme(const char *themeName) {
    EM_ASM({
        lvglSetColorTheme($0, UTF8ToString($1));
    }, eez::flow::g_wasmModuleId, themeName);
}

////////////////////////////////////////////////////////////////////////////////

void createScreen(int screenIndex) {
    EM_ASM({
        lvglCreateScreen($0, $1);
    }, eez::flow::g_wasmModuleId, screenIndex);
}

void deleteScreen(int screenIndex) {
    EM_ASM({
        lvglDeleteScreen($0, $1);
    }, eez::flow::g_wasmModuleId, screenIndex);
}

////////////////////////////////////////////////////////////////////////////////

static void on_event_handler(lv_event_t *e) {
    EM_ASM({
        lvglOnEventHandler($0, $1, $2, $3);
    }, eez::flow::g_wasmModuleId, lv_event_get_user_data(e), lv_event_get_code(e), e);
}

EM_PORT_API(void) lvglAddEventHandler(lv_obj_t *obj, lv_event_code_t eventCode) {
    lv_obj_add_event_cb(obj, on_event_handler, eventCode, obj);
}

////////////////////////////////////////////////////////////////////////////////

extern "C" void flowInit(uint32_t wasmModuleId, uint32_t debuggerMessageSubsciptionFilter, uint8_t *assets, uint32_t assetsSize, bool darkTheme, uint32_t timeZone, bool screensLifetimeSupport) {
    lv_disp_t * dispp = lv_disp_get_default();
    lv_theme_t * theme = lv_theme_default_init(dispp, lv_palette_main(LV_PALETTE_BLUE), lv_palette_main(LV_PALETTE_RED), darkTheme, LV_FONT_DEFAULT);
    //DISPLAY_WIDTH = eez::g_mainAssets->settings->displayWidth;
    //DISPLAY_HEIGHT = eez::g_mainAssets->settings->displayHeight;

    eez::flow::g_wasmModuleId = wasmModuleId;

    eez::flow::date::g_timeZone = timeZone;

    eez::initAssetsMemory();
    eez::loadMainAssets(assets, assetsSize);
    eez::initOtherMemory();
    eez::initAllocHeap(eez::ALLOC_BUFFER, eez::ALLOC_BUFFER_SIZE);

    eez::flow::startToDebuggerMessageHook = startToDebuggerMessage;
    eez::flow::writeDebuggerBufferHook = writeDebuggerBuffer;
    eez::flow::finishToDebuggerMessageHook = finishToDebuggerMessage;
    eez::flow::replacePageHook = replacePageHook;
    eez::flow::stopScriptHook = stopScript;
    eez::flow::getLvglObjectFromIndexHook = getLvglObjectFromIndex;
    eez::flow::getLvglScreenByNameHook = getLvglScreenByName;
    eez::flow::getLvglObjectByNameHook = getLvglObjectByName;
    eez::flow::getLvglGroupByNameHook = getLvglGroupByName;
    eez::flow::getLvglStyleByNameHook = getLvglStyleByName;
    eez::flow::getLvglImageByNameHook = getLvglImageByName;
    eez::flow::lvglObjAddStyleHook = lvglObjAddStyle;
    eez::flow::lvglObjRemoveStyleHook = lvglObjRemoveStyle;
    eez::flow::getLvglGroupFromIndexHook = getLvglGroupFromIndex;
    eez::flow::lvglSetColorThemeHook = lvglSetColorTheme;

    eez::flow::setDebuggerMessageSubsciptionFilter(debuggerMessageSubsciptionFilter);
    eez::flow::onDebuggerClientConnected();

    eez::flow::start(eez::g_mainAssets);

    g_screensLifetimeSupport = screensLifetimeSupport;
    if (g_screensLifetimeSupport) {
        eez_flow_set_create_screen_func(createScreen);
        eez_flow_set_delete_screen_func(deleteScreen);
    }

    g_currentScreen = 0;
}

extern "C" bool flowTick() {
    if (eez::flow::isFlowStopped()) {
        return false;
    }

    eez::flow::tick();

    if (eez::flow::isFlowStopped()) {
        return false;
    }

    doAnimate();

    doUpdateTasks();

    EM_ASM({
        lvglScreenTick($0);
    }, eez::flow::g_wasmModuleId);

    return true;
}

void flowOnPageLoadedStudio(unsigned pageIndex) {
    if (g_currentScreen == -1) {
        g_currentScreen = pageIndex;
    }
    eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
}

native_var_t native_vars[] = {
    { NATIVE_VAR_TYPE_NONE, 0, 0 },
};
