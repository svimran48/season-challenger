#!/bin/sh
# Installs the built app on the running emulator, opens it, and fails if it crashes or quits.
mkdir -p smoke
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb logcat -c
adb shell monkey -p com.seasonchallenger.app -c android.intent.category.LAUNCHER 1
sleep 45
adb exec-out screencap -p > smoke/first-screen.png
sleep 30
adb exec-out screencap -p > smoke/after-75s.png
adb logcat -d > smoke/logcat.txt
adb logcat -d -b crash > smoke/crash.txt
adb shell dumpsys gfxinfo com.seasonchallenger.app > smoke/gfxinfo.txt
adb shell dumpsys meminfo com.seasonchallenger.app > smoke/meminfo.txt
adb shell pidof com.seasonchallenger.app > smoke/pid.txt || true
if ! [ -s smoke/pid.txt ]; then
  echo 'The app is not running: it crashed or quit.'
  exit 1
fi
if grep -q 'com.seasonchallenger.app' smoke/crash.txt; then
  echo 'The crash log names the app.'
  exit 1
fi
echo 'The app is running with no crash.'
