cmake_minimum_required(VERSION 3.10)

project(flow_runtime)

set (CMAKE_CXX_STANDARD 17)

#set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_SOURCE_DIR}/cmake/")

set(CMAKE_CXX_FLAGS  "${CMAKE_CXX_FLAGS} -Wunused-const-variable -Wno-nested-anon-types -Wno-dollar-in-identifier-extension -O2 --no-entry")
set(CMAKE_EXE_LINKER_FLAGS  "${CMAKE_CXX_FLAGS} -s DEMANGLE_SUPPORT=1 -s FORCE_FILESYSTEM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=83886080 -s LLD_REPORT_UNDEFINED -s ASSERTIONS=1 -s EXPORTED_RUNTIME_METHODS=allocateUTF8,AsciiToString,UTF8ToString --bind -lidbfs.js --pre-js ${PROJECT_SOURCE_DIR}/src/platform/simulator/emscripten/pre.js --post-js ${PROJECT_SOURCE_DIR}/src/platform/simulator/emscripten/post.js")
add_definitions(-DEMCC_DEBUG)

set(CMAKE_CXX_FLAGS  "${CMAKE_CXX_FLAGS} -fpermissive -pedantic")

add_definitions(-DEEZ_PLATFORM_SIMULATOR)
add_definitions(-DEEZ_PLATFORM_SIMULATOR_UNIX)
add_definitions(-DEEZ_PLATFORM_SIMULATOR_EMSCRIPTEN)

include_directories(
    ./
    ./eez/libs/agg
    ./eez/platform/simulator
    ./src/conf
)


set(src_files)
set(header_files)


################################################################################
# EEZ Framework files
file(GLOB_RECURSE src_eez
    eez/*.cpp
    eez/*.c
)
file(GLOB_RECURSE header_eez
    eez/*.h
)

# exclude STM32 platform specific files
set (EXCLUDE_DIR "eez/platform/stm32")
foreach (TMP_PATH ${src_eez})
    string (FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)
    if (NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list (REMOVE_ITEM src_eez ${TMP_PATH})
    endif ()
endforeach(TMP_PATH)
foreach (TMP_PATH ${header_eez})
    string (FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)
    if (NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list (REMOVE_ITEM header_eez ${TMP_PATH})
    endif ()
endforeach(TMP_PATH)

# exclude libscpi
set (EXCLUDE_DIR "eez/libs/libscpi")
foreach (TMP_PATH ${src_eez})
    string (FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)
    if (NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list (REMOVE_ITEM src_eez ${TMP_PATH})
    endif ()
endforeach(TMP_PATH)
foreach (TMP_PATH ${header_eez})
    string (FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)
    if (NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list (REMOVE_ITEM header_eez ${TMP_PATH})
    endif ()
endforeach(TMP_PATH)

list (APPEND src_files ${src_eez})
list (APPEND header_files ${header_eez})

################################################################################


################################################################################
file(GLOB_RECURSE src_flow_runtime
    src/*.cpp
    src/*.c
)
file(GLOB_RECURSE header_flow_runtime
    src/*.h
)

list (APPEND src_files ${src_flow_runtime})
list (APPEND header_files ${header_flow_runtime})

################################################################################

add_executable(flow_runtime ${src_files} ${header_files})

if(${CMAKE_SYSTEM_NAME} STREQUAL "Emscripten")
    add_custom_command(TARGET flow_runtime POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        "${PROJECT_SOURCE_DIR}/build/emscripten/flow_runtime.js"
        "${PROJECT_SOURCE_DIR}/..")

    add_custom_command(TARGET flow_runtime POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        "${PROJECT_SOURCE_DIR}/build/emscripten/flow_runtime.js"
        "${PROJECT_SOURCE_DIR}/../../../../../build/project-editor/flow/runtime")


    add_custom_command(TARGET flow_runtime POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        "${PROJECT_SOURCE_DIR}/build/emscripten/flow_runtime.wasm"
        "${PROJECT_SOURCE_DIR}/..")

    add_custom_command(TARGET flow_runtime POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        "${PROJECT_SOURCE_DIR}/build/emscripten/flow_runtime.wasm"
        "${PROJECT_SOURCE_DIR}/../../../../../build/project-editor/flow/runtime")
endif()
