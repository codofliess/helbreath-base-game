cmake_minimum_required(VERSION 3.20)
project(cl_arena_client LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(CL_ARENA_BUILD_BOOTSTRAP "Build M0 bootstrap harness (no Olympia engine)" ON)

add_library(cl_arena_net STATIC
    src/network.cpp
)
target_include_directories(cl_arena_net PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Optional: generated protobuf (after scripts/gen-proto.ps1)
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/generated/proto")
    file(GLOB CL_PROTO_SRCS CONFIGURE_DEPENDS
        "${CMAKE_CURRENT_SOURCE_DIR}/generated/proto/*.pb.cc")
    if(CL_PROTO_SRCS)
        add_library(cl_arena_proto STATIC ${CL_PROTO_SRCS})
        target_include_directories(cl_arena_proto PUBLIC
            ${CMAKE_CURRENT_SOURCE_DIR}/generated/proto)
        find_package(Protobuf QUIET)
        if(Protobuf_FOUND)
            target_link_libraries(cl_arena_proto PUBLIC protobuf::libprotobuf)
            target_link_libraries(cl_arena_net PUBLIC cl_arena_proto)
            target_compile_definitions(cl_arena_net PUBLIC CL_ARENA_HAS_PROTO=1)
        endif()
    endif()
endif()

if(CL_ARENA_BUILD_BOOTSTRAP)
    add_executable(cl_arena_bootstrap src/main.cpp)
    target_link_libraries(cl_arena_bootstrap PRIVATE cl_arena_net)
    if(MSVC)
        target_compile_options(cl_arena_bootstrap PRIVATE /W4 /permissive-)
    else()
        target_compile_options(cl_arena_bootstrap PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endif()

# Future: link vendor/olympia-client as OBJECT or STATIC library target "olympia_engine"
# add_subdirectory(vendor/olympia-client EXCLUDE_FROM_ALL)

message(STATUS "CL Arena: bootstrap=${CL_ARENA_BUILD_BOOTSTRAP}")
