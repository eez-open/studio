cmake_minimum_required(VERSION 3.10)

project(lz4)

set(CMAKE_CXX_STANDARD 17)

# set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_SOURCE_DIR}/cmake/")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wunused-const-variable -Wno-nested-anon-types -Wno-dollar-in-identifier-extension -fpermissive -pedantic -O2 --no-entry")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s NODEJS_CATCH_EXIT=0 -s NODEJS_CATCH_REJECTION=0 -s DEMANGLE_SUPPORT=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=83886080 -s LLD_REPORT_UNDEFINED -s EXPORTED_FUNCTIONS=_malloc,_free --pre-js ${PROJECT_SOURCE_DIR}/pre.js --post-js ${PROJECT_SOURCE_DIR}/post.js")

include_directories(
    ../eez-framework/src/eez/libs/lz4
)

file(GLOB_RECURSE src_files
    ./*.cpp
    ./*.c
    ./*.h
)

file(GLOB_RECURSE header_files
    ./*.h
)

add_executable(lz4 ${src_files} ${header_files})

add_custom_command(TARGET lz4 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lz4.js"
    "${PROJECT_SOURCE_DIR}/../../packages/project-editor/flow/runtime")

add_custom_command(TARGET lz4 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lz4.js"
    "${PROJECT_SOURCE_DIR}/../../build/project-editor/flow/runtime")

add_custom_command(TARGET lz4 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lz4.wasm"
    "${PROJECT_SOURCE_DIR}/../../packages/project-editor/flow/runtime")

add_custom_command(TARGET lz4 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
    "${PROJECT_SOURCE_DIR}/build/lz4.wasm"
    "${PROJECT_SOURCE_DIR}/../../build/project-editor/flow/runtime")
