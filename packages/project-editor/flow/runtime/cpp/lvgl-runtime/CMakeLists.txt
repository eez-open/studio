cmake_minimum_required(VERSION 3.12)
project(lvgl_runtime)

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2 -s USE_SDL=2 --no-entry")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s DEMANGLE_SUPPORT=1 -s DISABLE_DEPRECATED_FIND_EVENT_TARGET_BEHAVIOR=0 --pre-js ${PROJECT_SOURCE_DIR}/pre.js --post-js ${PROJECT_SOURCE_DIR}/post.js")

include_directories(${PROJECT_SOURCE_DIR})

add_subdirectory(lvgl)
add_subdirectory(lv_drivers)
file(GLOB MY_SOURCES "./*.c")
set(SOURCES ${MY_SOURCES})

add_executable(lvgl_runtime ${SOURCES} ${INCLUDES})

if(NOT LVGL_CHOSEN_DEMO)
    set(LVGL_CHOSEN_DEMO lv_demo_widgets)
endif()

set_source_files_properties(main.c PROPERTIES COMPILE_FLAGS -DCHOSEN_DEMO=${LVGL_CHOSEN_DEMO})

set(CMAKE_EXECUTABLE_SUFFIX ".html")
target_link_libraries(lvgl_runtime
    lvgl
    lvgl_examples
    lvgl_demos
    lv_drivers
)

# set_target_properties(index PROPERTIES LINK_FLAGS "--shell-file ${PROJECT_SOURCE_DIR}/lvgl_shell.html")
add_custom_command(TARGET lvgl_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lvgl_runtime.js"
    "${PROJECT_SOURCE_DIR}/../..")

add_custom_command(TARGET lvgl_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lvgl_runtime.js"
    "${PROJECT_SOURCE_DIR}/../../../../../../build/project-editor/flow/runtime")

add_custom_command(TARGET lvgl_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lvgl_runtime.wasm"
    "${PROJECT_SOURCE_DIR}/../..")

add_custom_command(TARGET lvgl_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lvgl_runtime.wasm"
    "${PROJECT_SOURCE_DIR}/../../../../../../build/project-editor/flow/runtime")
