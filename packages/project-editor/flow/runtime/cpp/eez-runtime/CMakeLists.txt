cmake_minimum_required(VERSION 3.10)

project(eez_runtime)

set(CMAKE_CXX_STANDARD 17)

# set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_SOURCE_DIR}/cmake/")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wunused-const-variable -Wno-nested-anon-types -Wno-dollar-in-identifier-extension -O2 --no-entry")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s DEMANGLE_SUPPORT=1 -s FORCE_FILESYSTEM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=83886080 -s LLD_REPORT_UNDEFINED -s ASSERTIONS=1 -s EXPORTED_RUNTIME_METHODS=allocateUTF8,AsciiToString,UTF8ToString --bind -lidbfs.js --pre-js ${PROJECT_SOURCE_DIR}/platform/simulator/emscripten/pre.js --post-js ${PROJECT_SOURCE_DIR}/platform/simulator/emscripten/post.js")
add_definitions(-DEMCC_DEBUG)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fpermissive -pedantic")

include_directories(
    ./
    ../eez-framework/src/
    ../eez-framework/src/eez/libs/agg
    ../eez-framework/src/eez/platform/simulator
)

set(src_files)
set(header_files)

# ###############################################################################
# EEZ Framework files
file(GLOB_RECURSE src_eez
    ../eez-framework/src/eez/*.cpp
    ../eez-framework/src/eez/*.c
)
file(GLOB_RECURSE header_eez
    ../eez-framework/src/eez/*.h
)

# exclude libscpi
set(EXCLUDE_DIR "../eez-framework/src/eez/libs/libscpi")

foreach(TMP_PATH ${src_eez})
    string(FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)

    if(NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list(REMOVE_ITEM src_eez ${TMP_PATH})
    endif()
endforeach(TMP_PATH)

foreach(TMP_PATH ${header_eez})
    string(FIND ${TMP_PATH} ${EXCLUDE_DIR} EXCLUDE_DIR_FOUND)

    if(NOT ${EXCLUDE_DIR_FOUND} EQUAL -1)
        list(REMOVE_ITEM header_eez ${TMP_PATH})
    endif()
endforeach(TMP_PATH)

list(APPEND src_files ${src_eez})
list(APPEND header_files ${header_eez})

# ###############################################################################

# ###############################################################################
file(GLOB_RECURSE src_eez_runtime
    ./*.cpp
    ./*.c
)
file(GLOB_RECURSE header_eez_runtime
    ./*.h
)

list(APPEND src_files ${src_eez_runtime})
list(APPEND header_files ${header_eez_runtime})

# ###############################################################################
add_executable(eez_runtime ${src_files} ${header_files})

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/emscripten/eez_runtime.js"
    "${PROJECT_SOURCE_DIR}/../..")

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/emscripten/eez_runtime.js"
    "${PROJECT_SOURCE_DIR}/../../../../../../build/project-editor/flow/runtime")

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/emscripten/eez_runtime.wasm"
    "${PROJECT_SOURCE_DIR}/../..")

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/emscripten/eez_runtime.wasm"
    "${PROJECT_SOURCE_DIR}/../../../../../../build/project-editor/flow/runtime")
