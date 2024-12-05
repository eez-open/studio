cmake_minimum_required(VERSION 3.10)

project(eez_runtime)

set(CMAKE_CXX_STANDARD 17)

# set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_SOURCE_DIR}/cmake/")

# Release
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wunused-const-variable -Wno-nested-anon-types -Wno-dollar-in-identifier-extension -O2 --no-entry")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s NODEJS_CATCH_EXIT=0 -s NODEJS_CATCH_REJECTION=0 -s FORCE_FILESYSTEM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=8388608 -s LLD_REPORT_UNDEFINED -s ASSERTIONS=1 -s EXPORTED_FUNCTIONS=_malloc,_free -s EXPORTED_RUNTIME_METHODS=allocateUTF8,AsciiToString,UTF8ToString --bind -lidbfs.js --pre-js ${PROJECT_SOURCE_DIR}/platform/simulator/emscripten/pre.js --post-js ${PROJECT_SOURCE_DIR}/platform/simulator/emscripten/post.js")

# debug:
# set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wunused-const-variable -Wno-nested-anon-types -Wno-dollar-in-identifier-extension -O2 --no-entry -g")
# set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s DEMANGLE_SUPPORT=1 -s NODEJS_CATCH_EXIT=0 -s NODEJS_CATCH_REJECTION=0 -s FORCE_FILESYSTEM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=83886080 -s LLD_REPORT_UNDEFINED -s ASSERTIONS=1 -s EXPORTED_FUNCTIONS=_malloc,_free -s EXPORTED_RUNTIME_METHODS=allocateUTF8,AsciiToString,UTF8ToString --bind -lidbfs.js --pre-js ${PROJECT_SOURCE_DIR}/platform/simulator/emscripten/pre.js --post-js ${PROJECT_SOURCE_DIR}/platform/simulator/emscripten/post.js")
# add_definitions(-DEMCC_DEBUG)
add_definitions(-DEEZ_FLOW_QUEUE_SIZE=100000)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fpermissive -pedantic")

add_definitions(-DEEZ_DISABLE_SCPI_PARSER)

include_directories(
    ./
    ../eez-framework/src/eez/platform/simulator
)

# eez-framework
add_subdirectory(../eez-framework [EXCLUDE_FROM_ALL])

# eez-runtime
file(GLOB_RECURSE SOURCES
    ./*.cpp
    ./*.c
)
add_executable(eez_runtime ${SOURCES})

target_link_libraries(eez_runtime
    eez-framework
)

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/eez_runtime.js"
    "${PROJECT_SOURCE_DIR}/../../packages/project-editor/flow/runtime")

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/eez_runtime.js"
    "${PROJECT_SOURCE_DIR}/../../build/project-editor/flow/runtime")

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/eez_runtime.wasm"
    "${PROJECT_SOURCE_DIR}/../../packages/project-editor/flow/runtime")

add_custom_command(TARGET eez_runtime POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/eez_runtime.wasm"
    "${PROJECT_SOURCE_DIR}/../../build/project-editor/flow/runtime")
