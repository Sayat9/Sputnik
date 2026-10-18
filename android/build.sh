#!/bin/sh
# Собирает APK из актуального ../app: копирует index.html и assets в assets/www,
# заменяет Google Fonts на локальные шрифты (приложение работает без интернета).
set -e
cd "$(dirname "$0")"
W=app/src/main/assets/www
rm -rf "$W"; mkdir -p "$W"
cp -r ../app/assets "$W/assets"
cp -r fonts "$W/fonts"
python3 - <<'PY'
import re
s = open("../app/index.html", encoding="utf-8").read()
s = re.sub(r'<link rel="preconnect"[^>]*>\n?', "", s)
s = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', '<link rel="stylesheet" href="fonts/fonts.css">', s)
s = re.sub(r'<meta name="claude:[^>]*>\n?', "", s)
s = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
     '<meta name="theme-color" content="#120E09">\n' + s.replace("</style>\n", "</style>\n</head>\n<body>\n", 1) + "</body>\n</html>\n")
import datetime
stamp = (datetime.datetime.utcnow() + datetime.timedelta(hours=5)).strftime("%d.%m.%Y %H:%M")
s = s.replace('const APP_BUILD = "";', 'const APP_BUILD = "%s";' % stamp, 1)
open("app/src/main/assets/www/index.html", "w", encoding="utf-8").write(s)
PY
# version.json: номер версии (время сборки) и список файлов — по нему приложение скачивает обновления.
python3 - <<'PY'
import json, os, time
W = "app/src/main/assets/www"
files = sorted(os.path.relpath(os.path.join(d, f), W) for d, _, fs in os.walk(W) for f in fs if f != "version.json")
json.dump({"version": int(time.time()), "files": files}, open(W + "/version.json", "w"), ensure_ascii=False, indent=1)
PY
# WWW_ONLY=1 — только собрать www (для обновления по сети), без APK.
[ -n "$WWW_ONLY" ] && exit 0
export ANDROID_HOME=/opt/android-sdk
gradle -q --max-workers=1 assembleRelease
cp app/build/outputs/apk/release/app-release.apk sputnik.apk
ls -la sputnik.apk
