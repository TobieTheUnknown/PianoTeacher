cmake_minimum_required(VERSION 3.22.1)
project(piano_teacher_audio)

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
target_link_options(piano_teacher_audio PRIVATE "-Wl,-z,max-page-size=16384")
