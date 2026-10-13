cmake_minimum_required(VERSION 3.28)
project(chainlords-native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /permissive- /Zc:__cplusplus)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

option(CHAINLORDS_FETCH_SFML "Download SFML 3.1 when it is not already installed" ON)

find_package(SFML 3 CONFIG QUIET COMPONENTS Window)
if(NOT SFML_FOUND)
    if(NOT CHAINLORDS_FETCH_SFML)
        message(FATAL_ERROR "SFML 3 Window component was not found")
    endif()
    include(FetchContent)
    set(SFML_BUILD_AUDIO OFF CACHE BOOL "" FORCE)
    set(SFML_BUILD_NETWORK OFF CACHE BOOL "" FORCE)
    set(SFML_BUILD_GRAPHICS OFF CACHE BOOL "" FORCE)
    set(SFML_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(SFML_BUILD_TEST_SUITE OFF CACHE BOOL "" FORCE)
    FetchContent_Declare(
        SFML
        GIT_REPOSITORY https://github.com/SFML/SFML.git
        GIT_TAG 3.1.0
        GIT_SHALLOW TRUE
    )
    FetchContent_MakeAvailable(SFML)
endif()

find_package(Protobuf REQUIRED)
find_package(OpenGL REQUIRED)

set(CHAINLORDS_PROTO "${CMAKE_CURRENT_SOURCE_DIR}/../../multiplayer/proto/network.proto")
if(NOT EXISTS "${CHAINLORDS_PROTO}")
    message(FATAL_ERROR "network.proto not found at ${CHAINLORDS_PROTO}")
endif()

protobuf_generate_cpp(CHAINLORDS_PROTO_SRCS CHAINLORDS_PROTO_HDRS "${CHAINLORDS_PROTO}")
add_library(chainlords_proto STATIC ${CHAINLORDS_PROTO_SRCS} ${CHAINLORDS_PROTO_HDRS})
target_include_directories(chainlords_proto PUBLIC "${CMAKE_CURRENT_BINARY_DIR}")
if(TARGET protobuf::libprotobuf)
    target_link_libraries(chainlords_proto PUBLIC protobuf::libprotobuf)
else()
    target_include_directories(chainlords_proto PUBLIC ${Protobuf_INCLUDE_DIRS})
    target_link_libraries(chainlords_proto PUBLIC ${Protobuf_LIBRARIES})
endif()
if(MSVC)
    target_compile_options(chainlords_proto PRIVATE /w)
else()
    target_compile_options(chainlords_proto PRIVATE -w)
endif()

set(CHAINLORDS_REPO_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../..")
set(CHAINLORDS_RULES_FILE "${CMAKE_CURRENT_SOURCE_DIR}/economy/unavailable.rules")

add_library(chainlords_core STATIC
    src/core/TileMap.cpp
    src/core/IsoFrame.cpp
    src/core/economy/Rules.cpp
    src/core/nft/NftDropPort.cpp
)
target_include_directories(chainlords_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/src")

add_library(chainlords_assets STATIC
    src/adapters/assets/Binary.cpp
    src/adapters/assets/Sprite.cpp
    src/adapters/assets/Image.cpp
    src/adapters/assets/SampleAssets.cpp
)
target_include_directories(chainlords_assets PUBLIC
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/third_party"
)
target_link_libraries(chainlords_assets PUBLIC chainlords_core)

add_library(chainlords_net STATIC
    src/adapters/net/ProtobufSession.cpp
)
target_include_directories(chainlords_net PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/src")
target_link_libraries(chainlords_net PUBLIC chainlords_core chainlords_proto)

add_library(chainlords_render STATIC
    src/adapters/render/GlApi.cpp
    src/adapters/render/Renderer.cpp
    src/adapters/input/SfmlInput.cpp
)
target_include_directories(chainlords_render PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/src")
target_link_libraries(chainlords_render PUBLIC chainlords_core SFML::Window OpenGL::GL)

add_executable(chainlords-native
    src/main.cpp
    src/app/Application.cpp
)
target_link_libraries(chainlords-native PRIVATE chainlords_render chainlords_assets chainlords_net)
target_compile_definitions(chainlords-native PRIVATE
    CHAINLORDS_REPO_ROOT="${CHAINLORDS_REPO_ROOT}"
)

add_executable(chainlords-tests tests/core_tests.cpp)
target_link_libraries(chainlords-tests PRIVATE chainlords_assets chainlords_net)
target_compile_definitions(chainlords-tests PRIVATE
    CHAINLORDS_REPO_ROOT="${CHAINLORDS_REPO_ROOT}"
    CHAINLORDS_RULES_FILE="${CHAINLORDS_RULES_FILE}"
)

enable_testing()
add_test(NAME core COMMAND chainlords-tests)

include(GNUInstallDirs)
install(TARGETS chainlords-native RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
