cmake_minimum_required(VERSION 3.24)
project(singularity_garden VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

FetchContent_Declare(glfw
  GIT_REPOSITORY https://github.com/glfw/glfw.git
  GIT_TAG 3.4)
FetchContent_Declare(glm
  GIT_REPOSITORY https://github.com/g-truc/glm.git
  GIT_TAG 1.0.1)

FetchContent_MakeAvailable(glfw glm)

file(GLOB_RECURSE SOURCES src/*.cpp)
add_executable(singularity_garden ${SOURCES})

target_link_libraries(singularity_garden PRIVATE glfw glm::glm)
target_include_directories(singularity_garden PRIVATE src)

if(MSVC)
  target_compile_options(singularity_garden PRIVATE /W4 /WX)
else()
  target_compile_options(singularity_garden PRIVATE -Wall -Wextra -Werror)
endif()
