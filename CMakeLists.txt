cmake_minimum_required(VERSION 3.24)
project(singularity_garden VERSION 0.1.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

FetchContent_Declare(glfw
  GIT_REPOSITORY https://github.com/glfw/glfw.git
  GIT_TAG 3.4
  GIT_SHALLOW TRUE)

FetchContent_Declare(glm
  GIT_REPOSITORY https://github.com/g-truc/glm.git
  GIT_TAG 1.0.1
  GIT_SHALLOW TRUE)

FetchContent_Declare(glad
  GIT_REPOSITORY https://github.com/Dav1dde/glad.git
  GIT_TAG v2.0.8
  GIT_SHALLOW TRUE
  SOURCE_SUBDIR cmake)

FetchContent_Declare(miniaudio
  GIT_REPOSITORY https://github.com/mackron/miniaudio.git
  GIT_TAG 0.11.21
  GIT_SHALLOW TRUE)

FetchContent_MakeAvailable(glfw glm glad)
glad_add_library(glad_gl_46_core REPRODUCIBLE API gl:core=4.6)

FetchContent_GetProperties(miniaudio)
if(NOT miniaudio_POPULATED)
  FetchContent_Populate(miniaudio)
endif()

file(GLOB_RECURSE SOURCES "src/*.cpp" "src/*.c")
add_executable(singularity_garden ${SOURCES})

target_link_libraries(singularity_garden PRIVATE
  glfw
  glm::glm
  glad_gl_46_core
  ${CMAKE_DL_LIBS})

target_include_directories(singularity_garden PRIVATE
  src
  "${miniaudio_SOURCE_DIR}")

if(UNIX AND NOT APPLE)
  find_package(Threads REQUIRED)
  target_link_libraries(singularity_garden PRIVATE Threads::Threads m)
endif()

if(WIN32)
  target_link_libraries(singularity_garden PRIVATE ole32 winmm ksuser avrt)
endif()

add_custom_command(TARGET singularity_garden POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
    "${CMAKE_SOURCE_DIR}/shaders" "$<TARGET_FILE_DIR:singularity_garden>/shaders"
  COMMAND ${CMAKE_COMMAND} -E copy_directory
    "${CMAKE_SOURCE_DIR}/assets" "$<TARGET_FILE_DIR:singularity_garden>/assets"
  COMMENT "Deploying shaders and assets...")

if(MSVC)
  target_compile_options(singularity_garden PRIVATE /W3 /wd4244 /wd4305 /wd4201)
  target_compile_definitions(singularity_garden PRIVATE _CRT_SECURE_NO_WARNINGS)
else()
  target_compile_options(singularity_garden PRIVATE -Wall -Wextra -Wno-unused-parameter)
endif()
