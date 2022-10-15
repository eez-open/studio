cmake_minimum_required(VERSION 3.12)
project(lvgl_runtime)

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2 --no-entry")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s DEMANGLE_SUPPORT=1 -s DISABLE_DEPRECATED_FIND_EVENT_TARGET_BEHAVIOR=0 -s INITIAL_MEMORY=83886080 -s EXPORTED_RUNTIME_METHODS=allocateUTF8 --pre-js ${PROJECT_SOURCE_DIR}/pre.js --post-js ${PROJECT_SOURCE_DIR}/post.js")

include_directories(${PROJECT_SOURCE_DIR})

add_subdirectory(lvgl)
add_subdirectory(lv_drivers)

file(GLOB MY_SOURCES "./*.c" "./*.cpp")
set(SOURCES ${MY_SOURCES})

# ###############################################################################
# EEZ Framework
add_definitions(-DEEZ_PLATFORM_SIMULATOR)
add_definitions(-DEEZ_FOR_LVGL)
add_definitions(-DOPTION_GUI=0)

include_directories(
    ../
    ../eez/libs/agg
    ../eez/platform/simulator
    ./src/conf
)

set(src_files)

file(GLOB_RECURSE src_eez
    ../eez/*.cpp
    ../eez/*.c
)

# exclude gui specific files
set(EXCLUDE_DIR "../eez/gui")

foreach(TMP_PATH ${src_eez})
    string(FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)

    if(NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list(REMOVE_ITEM src_eez ${TMP_PATH})
    endif()
endforeach(TMP_PATH)

# exclude fs specific files
set(EXCLUDE_DIR "../eez/fs")

foreach(TMP_PATH ${src_eez})
    string(FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)

    if(NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list(REMOVE_ITEM src_eez ${TMP_PATH})
    endif()
endforeach(TMP_PATH)

# exclude STM32 platform specific files
set(EXCLUDE_DIR "../eez/platform/stm32")

foreach(TMP_PATH ${src_eez})
    string(FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)

    if(NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list(REMOVE_ITEM src_eez ${TMP_PATH})
    endif()
endforeach(TMP_PATH)

# exclude libscpi
set(EXCLUDE_DIR "../eez/libs/libscpi")

foreach(TMP_PATH ${src_eez})
    string(FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)

    if(NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list(REMOVE_ITEM src_eez ${TMP_PATH})
    endif()
endforeach(TMP_PATH)

# exclude agg
set(EXCLUDE_DIR "../eez/libs/agg")

foreach(TMP_PATH ${src_eez})
    string(FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)

    if(NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list(REMOVE_ITEM src_eez ${TMP_PATH})
    endif()
endforeach(TMP_PATH)

list(APPEND src_files ${src_eez})

file(GLOB_RECURSE src_eez_runtime
    ./src/*.cpp
    ./src/*.c
)

list(APPEND src_files ${src_eez_runtime})

list(APPEND SOURCES ${src_files})

# ###############################################################################
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
