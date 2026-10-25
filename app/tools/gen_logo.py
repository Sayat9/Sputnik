"""Пиксельный логотип «Исследователи лабиринта»: спираль-лабиринт со светящейся целью в центре.
Два цвета: основной (золото — игрок) и чуть сдвинутый (янтарь-оранжевый — версия ведущего). Рисует 24×24 и масштабирует без сглаживания.
Запуск: python3 tools/gen_logo.py — кладёт assets/logo.png, assets/logo-admin.png и значки Android (../android/app/src/<вариант>/res/mipmap-*)."""
from PIL import Image
import os

N = 24
THEMES = {
    "main":  dict(wall=(240, 180, 67), hi=(255, 226, 138), lo=(168, 112, 30), glow=(255, 244, 200), plate=(18, 14, 9), edge=(94, 70, 30)),
    "admin": dict(wall=(238, 138, 52), hi=(255, 196, 108), lo=(160, 86, 24), glow=(255, 236, 190), plate=(18, 12, 8), edge=(104, 62, 24)),
}

def art(t):
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0)); px = im.load()
    c = lambda k: t[k] + (255,)
    # плитка с обрезанными углами
    for y in range(N):
        for x in range(N):
            if (x in (0, N - 1) and y in (0, N - 1)) or (x in (0, N - 1) and y in (1, N - 2)) and False: continue
            px[x, y] = c("plate")
    for x in range(1, N - 1):
        for y in (0, N - 1): px[x, y] = c("edge")
    for y in range(1, N - 1):
        for x in (0, N - 1): px[x, y] = c("edge")
    for x, y in [(0, 0), (N - 1, 0), (0, N - 1), (N - 1, N - 1)]: px[x, y] = (0, 0, 0, 0)
    # кольца-стены; у каждого кольца проход, проходы чередуются
    rings = [(2, "bottom"), (5, "top"), (8, "bottom"), (11, "top")]
    for i, (o, gap) in enumerate(rings):
        a, b = o, N - 1 - o
        for x in range(a, b + 1):
            for y in (a, b):
                px[x, y] = c("hi") if y == a else c("lo")
        for y in range(a, b + 1):
            for x in (a, b):
                px[x, y] = c("hi") if x == a else c("lo")
        px[a, a] = c("hi"); px[b, b] = c("lo")
        # проход (2 клетки) в нужной стороне, смещённый от центра
        mid = (a + b) // 2
        if gap == "bottom": gx, gy = [(a + 2, b), (a + 3, b)][0][0], b; cells = [(a + 2, b), (a + 3, b)]
        else: cells = [(b - 3, a), (b - 2, a)]
        for (x, y) in cells: px[x, y] = c("plate")
        # те же клетки соседних колец ради «дороги»
    # центр: светящаяся цель
    for x in range(10, 14):
        for y in range(10, 14): px[x, y] = c("wall")
    for x in range(11, 13):
        for y in range(11, 13): px[x, y] = c("glow")
    return im

def save(im, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.resize((size, size), Image.NEAREST).save(path)

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__)) + "/.."
    main, admin = art(THEMES["main"]), art(THEMES["admin"])
    save(main, here + "/assets/logo.png", 192); save(admin, here + "/assets/logo-admin.png", 192)
    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for flavor, im in (("player", main), ("master", admin)):
        for d, s in sizes.items(): save(im, f"{here}/../android/app/src/{flavor}/res/mipmap-{d}/ic_launcher.png", s)
