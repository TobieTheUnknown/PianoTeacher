cmake_minimum_required(VERSION 3.22.1)
project(piano_teacher_audio)

if(NOT ANDROID)
    enable_testing()
    find_package(Threads REQUIRED)
    add_executable(voice_mixer_test ../../test/cpp/voice_mixer_test.cpp)
    target_include_directories(voice_mixer_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
    target_compile_features(voice_mixer_test PRIVATE cxx_std_17)
    target_compile_options(voice_mixer_test PRIVATE -Wall -Wextra -Werror -UNDEBUG)
    target_link_libraries(voice_mixer_test PRIVATE Threads::Threads)
    add_test(NAME voice_mixer COMMAND voice_mixer_test)
    set_tests_properties(voice_mixer PROPERTIES TIMEOUT 20)
    return()
endif()

# Find Oboe
find_package(oboe REQUIRED CONFIG)

add_library(
    piano_teacher_audio
    SHARED
    audio_engine.cpp
)

target_link_libraries(
    piano_teacher_audio
    oboe::oboe
    android
    log
)

# Android 15+ requires ELF LOAD segments aligned to 16KB
target_link_options(
    piano_teacher_audio
    PRIVATE
    "-Wl,-z,max-page-size=16384"
    "-Wl,-z,common-page-size=16384"
)
