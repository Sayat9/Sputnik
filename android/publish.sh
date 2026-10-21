#!/bin/sh
# Выпускает обновление: собирает www и отправляет проект в github.com/Sayat9/Sputnik.
# Телефоны с установленным APK скачают его при следующем запуске.
set -e
cd "$(dirname "$0")"
WWW_ONLY=1 ./build.sh
R=/home/user/repo-stage
cd "$R" && git pull -q --rebase origin main && cd - >/dev/null
find "$R/app" "$R/www" "$R/campaign" -mindepth 1 -delete
cp -r ../app/. "$R/app/" && rm -rf "$R/app/dist"
cp -r app/src/main/assets/www/. "$R/www/"
cp ../campaign/*.md "$R/campaign/"
tar cf - --exclude=./build --exclude=./.gradle --exclude=./app/build --exclude=./app/src/main/assets/www --exclude=./sputnik.apk . | tar xf - -C "$R/android"
cd "$R"
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "${1:-Обновление приложения}

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LqZZvha4EFgFgo5Ve6sugx"
git push -q origin main
echo "Опубликована версия $(python3 -c 'import json;print(json.load(open("www/version.json"))["version"])')"
