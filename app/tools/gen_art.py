"""Генератор иллюстраций для «Спутника исследователя».

Все картинки строятся из общих шаблонов, чтобы новые предметы и монстры
выглядели в одном стиле (см. docs/art-style.md):

  * pedestal()  — предмет на каменном пьедестале в нише лабиринта (оружие, броня, щиты);
  * portrait()  — погрудный портрет на тёмном фоне с тёплым контровым светом (расы, NPC);
  * monster_face() / monster_full() — иконка лица и полный рост монстра.

Запуск:  python3 tools/gen_art.py   → пишет SVG в assets/.
Чтобы добавить предмет: нарисуйте функцию, возвращающую SVG-группу предмета
в зоне y 20…165 вокруг x = 128, и добавьте её в ITEMS.
"""
from pathlib import Path
import math

OUT = Path(__file__).resolve().parent.parent / "assets"

# ---------------------------------------------------------------- общие defs

DEFS = """
<linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#6d767b"/><stop offset=".42" stop-color="#cfd3cf"/>
  <stop offset=".55" stop-color="#a3a9a6"/><stop offset="1" stop-color="#5d666b"/></linearGradient>
<linearGradient id="steelV" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#c4c8c3"/><stop offset=".5" stop-color="#8d9490"/><stop offset="1" stop-color="#59626a"/></linearGradient>
<linearGradient id="iron" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#2a2e31"/><stop offset=".5" stop-color="#717a80"/><stop offset="1" stop-color="#25292c"/></linearGradient>
<linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#4f3420"/><stop offset=".5" stop-color="#93683c"/><stop offset="1" stop-color="#4a301c"/></linearGradient>
<linearGradient id="leather" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#3a2418"/><stop offset=".5" stop-color="#714a30"/><stop offset="1" stop-color="#33200f"/></linearGradient>
<linearGradient id="brass" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#7a5a20"/><stop offset=".5" stop-color="#e2c06a"/><stop offset="1" stop-color="#6a4c18"/></linearGradient>
<linearGradient id="stone" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#454844"/><stop offset=".45" stop-color="#8f938c"/><stop offset="1" stop-color="#3c3f3b"/></linearGradient>
<radialGradient id="amber" cx=".4" cy=".35" r=".7">
  <stop offset="0" stop-color="#fff1c4"/><stop offset=".45" stop-color="#f0b443"/><stop offset="1" stop-color="#8a5310"/></radialGradient>
<filter id="worn" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feColorMatrix in="SourceGraphic" type="saturate" values=".72" result="dull"/>
  <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="n1"/>
  <feColorMatrix in="n1" type="matrix" values="0 0 0 0 .16  0 0 0 0 .12  0 0 0 0 .09  0 0 0 -3.2 1.38" result="grime"/>
  <feComposite in="grime" in2="SourceAlpha" operator="in" result="grimeIn"/>
  <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="11" result="n2"/>
  <feColorMatrix in="n2" type="matrix" values="0 0 0 0 .45  0 0 0 0 .22  0 0 0 0 .08  0 0 0 -5 1.78" result="rust"/>
  <feComposite in="rust" in2="SourceAlpha" operator="in" result="rustIn"/>
  <feMerge><feMergeNode in="dull"/><feMergeNode in="rustIn"/><feMergeNode in="grimeIn"/></feMerge>
</filter>
<filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
  <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity=".55"/></filter>
"""


def svg(w, h, body, extra_defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<defs>{DEFS}{extra_defs}</defs>{body}</svg>')


# ---------------------------------------------------------------- сцена пьедестала

NICHE_DEFS = """
<radialGradient id="niche" cx=".5" cy=".38" r=".75">
  <stop offset="0" stop-color="#4b514c"/><stop offset=".55" stop-color="#252a27"/><stop offset="1" stop-color="#101211"/></radialGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fff6dc" stop-opacity=".16"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></linearGradient>
<pattern id="bricks" width="64" height="32" patternUnits="userSpaceOnUse">
  <path d="M0 .5H64M0 16.5H64M32 0V16M.5 16V32" stroke="#000" stroke-opacity=".22" fill="none"/></pattern>
"""


def pedestal(item, stand=False):
    """Предмет на пьедестале. item — SVG-группа в зоне y 20…165 вокруг x=128."""
    pole = ('<rect x="123" y="140" width="10" height="32" fill="url(#wood)"/>' if stand else "")
    body = f"""
<rect width="256" height="256" fill="url(#niche)"/>
<rect width="256" height="256" fill="url(#bricks)"/>
<path d="M28 256V96C28 40 74 14 128 14S228 40 228 96V256" fill="#000" fill-opacity=".18"/>
<polygon points="98,0 158,0 206,256 50,256" fill="url(#beam)"/>
<ellipse cx="128" cy="238" rx="78" ry="11" fill="#000" fill-opacity=".5"/>
<rect x="60" y="214" width="136" height="16" rx="2" fill="url(#stone)"/>
<rect x="78" y="180" width="100" height="36" fill="url(#stone)"/>
<rect x="78" y="180" width="100" height="5" fill="#000" fill-opacity=".25"/>
<rect x="66" y="170" width="124" height="12" rx="2" fill="url(#stone)"/>
<rect x="66" y="170" width="124" height="2" fill="#fff" fill-opacity=".18"/>
<circle cx="128" cy="198" r="12" fill="#f0b443" opacity=".45" filter="url(#blur6)"/>
<polygon points="128,189 137,198 128,207 119,198" fill="url(#amber)" stroke="#5a3a0a" stroke-width="1"/>
<ellipse cx="128" cy="170" rx="54" ry="5" fill="#f0b443" opacity=".18" filter="url(#blur6)"/>
{pole}
<g filter="url(#drop)"><g filter="url(#worn)">{item}</g></g>
"""
    return svg(256, 256, body, NICHE_DEFS)


def place(group, x=128, y=95, rot=0, s=1.0):
    return f'<g transform="translate({x} {y}) rotate({rot}) scale({s})">{group}</g>'


def wrap_lines(x, y0, y1, w, step=5, color="#22150c"):
    return "".join(f'<path d="M{x - w / 2} {y} L{x + w / 2} {y + step * .8}" stroke="{color}" stroke-width="1.4"/>'
                   for y in range(int(y0), int(y1), step))


# ---------------------------------------------------------------- оружие

def nicks(pts):
    """Зазубрины на кромке: (x, y, сторона ±1)."""
    return "".join(f'<path d="M{x} {y - 2.5} L{x - 3.2 * d} {y} L{x} {y + 2.5}Z" fill="#1d2022"/>' for x, y, d in pts)


def scratches(lines):
    return "".join(f'<path d="M{a} {b} L{c} {e}" stroke="#e9ece8" stroke-width=".7" opacity=".55"/>' for a, b, c, e in lines)


def sword():
    g = """
<polygon points="-6,40 -6,-70 0,-84 6,-70 6,40" fill="url(#steel)" stroke="#3d4448" stroke-width="1"/>
<path d="M0 -64V34" stroke="#6c757a" stroke-width="1.6" opacity=".8"/>""" + nicks([(6, -40, 1), (-6, -12, -1), (6, 14, 1), (-6, 26, -1)]) + scratches([(-4, -50, 3, -44), (-3, 0, 4, 8)]) + """
<rect x="-26" y="39" width="52" height="8" rx="3" fill="url(#iron)" stroke="#1c1f21"/>
<circle cx="-26" cy="43" r="4" fill="url(#iron)"/><circle cx="26" cy="43" r="4" fill="url(#iron)"/>
<rect x="-4.5" y="47" width="9" height="28" fill="url(#leather)"/>""" + wrap_lines(0, 49, 74, 9) + """
<circle cx="0" cy="80" r="6.5" fill="url(#iron)" stroke="#1c1f21"/><circle cx="-2" cy="78" r="2" fill="#fff" opacity=".35"/>"""
    return place(g, rot=40)


def greatsword():
    g = """
<polygon points="-8.5,52 -8.5,-108 0,-126 8.5,-108 8.5,52" fill="url(#steel)" stroke="#3d4448" stroke-width="1"/>
<path d="M0 -100V46" stroke="#6c757a" stroke-width="2" opacity=".8"/>""" + nicks([(8.5, -70, 1), (-8.5, -40, -1), (8.5, -10, 1), (-8.5, 20, -1), (8.5, 30, 1)]) + scratches([(-6, -80, 5, -72), (-5, -20, 6, -14), (-6, 10, 4, 18)]) + """
<rect x="-8.5" y="40" width="17" height="12" fill="url(#iron)"/>
<path d="M-38 52 Q0 44 38 52 L38 60 Q0 54 -38 60Z" fill="url(#iron)" stroke="#1c1f21"/>
<circle cx="-39" cy="56" r="5" fill="url(#iron)"/><circle cx="39" cy="56" r="5" fill="url(#iron)"/>
<rect x="-5" y="60" width="10" height="44" fill="url(#leather)"/>""" + wrap_lines(0, 62, 104, 10) + """
<path d="M-7 104h14l-3 10h-8z" fill="url(#iron)" stroke="#1c1f21"/>"""
    return place(g, y=92, rot=40, s=.82)


def rapier():
    g = """
<polygon points="-2.6,30 -1.4,-104 0,-112 1.4,-104 2.6,30" fill="url(#steel)" stroke="#3d4448" stroke-width=".8"/>
<rect x="-22" y="29" width="44" height="4" rx="2" fill="url(#brass)"/>
<circle cx="-23" cy="31" r="3.4" fill="url(#brass)"/><circle cx="23" cy="31" r="3.4" fill="url(#brass)"/>
<ellipse cx="0" cy="31" rx="13" ry="7" fill="none" stroke="url(#brass)" stroke-width="2.4"/>
<path d="M18 31 C30 46 22 66 6 74" fill="none" stroke="url(#brass)" stroke-width="2.6"/>
<path d="M-12 33 C-20 44 -16 56 -6 60" fill="none" stroke="url(#brass)" stroke-width="2"/>
<rect x="-3.5" y="34" width="7" height="34" fill="url(#leather)"/>""" + wrap_lines(0, 35, 68, 7, 3, "#c9a24a") + """
<ellipse cx="0" cy="74" rx="6" ry="7" fill="url(#brass)" stroke="#4a3410"/>"""
    return place(g, y=96, rot=38, s=1.02)


def spear():
    g = """
<rect x="-3" y="-92" width="6" height="200" rx="2" fill="url(#wood)"/>
<path d="M0 -142 C11 -122 10 -104 3.5 -98 L3.5 -92 L-3.5 -92 L-3.5 -98 C-10 -104 -11 -122 0 -142Z" fill="url(#steel)" stroke="#3d4448"/>
<path d="M0 -136V-100" stroke="#6c757a" stroke-width="1.4"/>""" + nicks([(7.5, -116, 1), (-6, -106, -1)]) + """
<rect x="-4.5" y="-96" width="9" height="16" rx="1" fill="url(#iron)"/>
<rect x="-4" y="-40" width="8" height="26" fill="url(#leather)"/>""" + wrap_lines(0, -39, -14, 8, 4) + """
<path d="M-3.5 108h7l-1 8h-5z" fill="url(#iron)"/>"""
    return place(g, y=88, rot=42, s=.72)


def mace():
    g = """
<rect x="-3.5" y="-8" width="7" height="88" rx="2" fill="url(#iron)"/>
<rect x="-4.5" y="44" width="9" height="34" fill="url(#leather)"/>""" + wrap_lines(0, 45, 77, 9) + """
<circle cx="0" cy="84" r="6" fill="url(#iron)" stroke="#1c1f21"/>
<rect x="-12" y="-44" width="24" height="38" rx="5" fill="url(#iron)" stroke="#1c1f21"/>
<path d="M-12 -42 L-26 -32 L-26 -16 L-12 -8Z" fill="url(#steel)" stroke="#2f3538"/>
<path d="M12 -42 L26 -32 L26 -16 L12 -8Z" fill="url(#steel)" stroke="#2f3538"/>
<path d="M-4 -48 L4 -48 L5 -4 L-5 -4Z" fill="url(#steel)" stroke="#2f3538"/>
<circle cx="0" cy="-50" r="5" fill="url(#iron)" stroke="#1c1f21"/>"""
    return place(g, y=92, rot=28, s=1.12)


def warhammer():
    g = """
<rect x="-3.5" y="-40" width="7" height="120" rx="2" fill="url(#wood)"/>
<rect x="-4.5" y="48" width="9" height="30" fill="url(#leather)"/>""" + wrap_lines(0, 49, 77, 9) + """
<rect x="-3" y="-30" width="6" height="34" fill="url(#iron)"/>
<rect x="-8" y="-52" width="16" height="26" rx="2" fill="url(#iron)" stroke="#1c1f21"/>
<path d="M8 -54 H30 V-24 H8Z" fill="url(#steelV)" stroke="#2f3538"/>
<path d="M30 -54 L34 -50 V-28 L30 -24Z" fill="#cfd6da" stroke="#2f3538"/>
<path d="M-8 -48 L-36 -40 L-8 -30Z" fill="url(#steelV)" stroke="#2f3538"/>
<path d="M-3 -52 L0 -66 L3 -52Z" fill="url(#steelV)" stroke="#2f3538"/>"""
    return place(g, y=98, rot=24, s=1.12)


def bow(length, bulge, rot):
    L = length
    g = f"""
<path d="M-2 {-L} Q{bulge} 0 -2 {L}" fill="none" stroke="#2a1a0e" stroke-width="9" stroke-linecap="round"/>
<path d="M-2 {-L} Q{bulge} 0 -2 {L}" fill="none" stroke="url(#wood)" stroke-width="6" stroke-linecap="round"/>
<path d="M-2 {-L} L-2 {L}" stroke="#e8e0c8" stroke-width="1.3"/>
<path d="M-2 {-L} q-4 -4 -2 -9 M-2 {L} q-4 4 -2 9" stroke="url(#wood)" stroke-width="4" fill="none" stroke-linecap="round"/>
<rect x="{bulge / 2 - 6}" y="-14" width="10" height="28" rx="3" fill="url(#leather)"/>"""
    return place(g, x=118, y=94, rot=rot)


def shortbow():
    return bow(62, 46, -18)


def longbow():
    return bow(80, 40, -24)


def arrows():
    one = """
<rect x="-1.5" y="-70" width="3" height="128" fill="url(#wood)"/>
<path d="M0 -84 L5 -68 L-5 -68Z" fill="url(#steel)" stroke="#3d4448" stroke-width=".8"/>
<path d="M-1.5 36 L-9 44 L-9 60 L-1.5 54Z" fill="#c8bfa8"/><path d="M1.5 36 L9 44 L9 60 L1.5 54Z" fill="#8a3a2a"/>"""
    g = "".join(f'<g transform="rotate({a} 0 60)">{one}</g>' for a in (-16, -5, 6, 17))
    g += '<rect x="-9" y="20" width="18" height="6" rx="2" fill="url(#leather)"/>'
    return place(g, y=96, s=.95)


def shield():
    planks = "".join(
        f'<rect x="{x}" y="22" width="20" height="142" fill="{c}"/><path d="M{x} 22V164" stroke="#2a1a0e" stroke-width="1.2"/>'
        for x, c in zip(range(58, 200, 20), ["#7a5432", "#8b6139", "#71492b", "#8e663c", "#7d5534", "#6c4628", "#86603a"]))
    rivets = "".join(
        f'<circle cx="{128 + 64 * math.cos(a):.1f}" cy="{93 + 64 * math.sin(a):.1f}" r="2.6" fill="#c9d0d4" stroke="#2a2e31"/>'
        for a in [i * math.pi / 6 for i in range(12)])
    g = f"""
<clipPath id="shieldClip"><circle cx="128" cy="93" r="70"/></clipPath>
<g clip-path="url(#shieldClip)">{planks}
<circle cx="110" cy="70" r="80" fill="#fff" opacity=".08"/></g>
<circle cx="128" cy="93" r="70" fill="none" stroke="url(#iron)" stroke-width="9"/>
<circle cx="128" cy="93" r="74" fill="none" stroke="#15181a" stroke-width="1.2"/>
{rivets}
<circle cx="128" cy="93" r="24" fill="#2a2e31"/>
<circle cx="128" cy="93" r="20" fill="url(#steelV)" stroke="#2a2e31" stroke-width="1.5"/>
<ellipse cx="121" cy="86" rx="6" ry="4" fill="#fff" opacity=".45"/>"""
    return g


# ---------------------------------------------------------------- броня

TORSO = "M84 52 Q128 42 172 52 L192 68 L184 84 L176 150 Q128 164 80 150 L72 84 L64 68 Z"
ARMOR_DEFS = f"""
<clipPath id="torso"><path d="{TORSO}"/></clipPath>
<pattern id="quilt" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <path d="M0 .5H12M.5 0V12" stroke="#5e5240" stroke-width="1.2"/></pattern>
<pattern id="studs" width="12" height="12" patternUnits="userSpaceOnUse">
  <circle cx="6" cy="6" r="1.9" fill="url(#brass)" stroke="#3a2a0c" stroke-width=".5"/></pattern>
<pattern id="chain" width="6" height="5" patternUnits="userSpaceOnUse">
  <circle cx="3" cy="2.5" r="2.1" fill="none" stroke="#c4cbcf" stroke-width="1"/>
  <circle cx="0" cy="0" r="2.1" fill="none" stroke="#8e979c" stroke-width="1"/>
  <circle cx="6" cy="0" r="2.1" fill="none" stroke="#8e979c" stroke-width="1"/></pattern>
<pattern id="rings" width="11" height="11" patternUnits="userSpaceOnUse">
  <circle cx="5.5" cy="5.5" r="3.4" fill="none" stroke="#9aa3a8" stroke-width="1.6"/></pattern>
<pattern id="scales" width="12" height="10" patternUnits="userSpaceOnUse">
  <path d="M0 0 Q0 10 6 10 Q12 10 12 0" fill="url(#steelV)" stroke="#3a4145" stroke-width=".8"/>
  <path d="M-6 5 Q-6 15 0 15 Q6 15 6 5 M6 5 Q6 15 12 15 Q18 15 18 5" fill="url(#steelV)" stroke="#3a4145" stroke-width=".8"/></pattern>
<pattern id="fur" width="10" height="10" patternUnits="userSpaceOnUse">
  <path d="M2 2 q2 4 0 7 M6 0 q2 5 1 9 M9 4 q1 3 -1 6" stroke="#3e3224" stroke-width="1" fill="none"/></pattern>
<pattern id="splint" width="14" height="80" patternUnits="userSpaceOnUse">
  <rect x="1" y="0" width="11" height="80" rx="2" fill="url(#steelV)" stroke="#2f3538"/>
  <circle cx="6.5" cy="8" r="1.4" fill="#2a2e31"/><circle cx="6.5" cy="40" r="1.4" fill="#2a2e31"/></pattern>
"""


def torso(fill, overlay="", extra_under="", extra_over=""):
    return f"""
<rect x="124" y="28" width="8" height="24" fill="url(#wood)"/><ellipse cx="128" cy="28" rx="9" ry="6" fill="url(#wood)"/>
{extra_under}
<path d="{TORSO}" fill="{fill}" stroke="#15181a" stroke-width="1.5"/>
<g clip-path="url(#torso)">{overlay}
<path d="M64 40 H128 V170 H64Z" fill="#fff" opacity=".06"/><path d="M150 40 H200 V170 H150Z" fill="#000" opacity=".2"/></g>
<path d="M108 50 Q128 64 148 50" fill="#1a1d1b" stroke="#15181a"/>
{extra_over}"""


def belt(y=136, color="url(#leather)"):
    return (f'<path d="M78 {y} Q128 {y + 10} 178 {y} L177 {y + 9} Q128 {y + 19} 79 {y + 9}Z" fill="{color}" stroke="#15181a"/>'
            f'<rect x="121" y="{y + 3}" width="14" height="12" rx="2" fill="none" stroke="url(#brass)" stroke-width="2.5"/>')


def pauldrons(fill="url(#steelV)"):
    return (f'<path d="M62 64 Q66 46 92 50 L96 72 Q78 80 62 64Z" fill="{fill}" stroke="#2a2e31" stroke-width="1.3"/>'
            f'<path d="M194 64 Q190 46 164 50 L160 72 Q178 80 194 64Z" fill="{fill}" stroke="#2a2e31" stroke-width="1.3"/>')


def fauld(y=148):
    return "".join(
        f'<path d="M{84 - i * 2} {y + i * 7} Q128 {y + 10 + i * 7} {172 + i * 2} {y + i * 7} L{172 + i * 2} {y + 8 + i * 7} '
        f'Q128 {y + 18 + i * 7} {84 - i * 2} {y + 8 + i * 7}Z" fill="url(#steelV)" stroke="#2a2e31"/>' for i in range(2))


def armor_item(kind):
    leather = "url(#leather)"
    if kind == "padded":
        return torso("#b8a98a", '<rect width="256" height="256" fill="url(#quilt)"/>')
    if kind == "leather":
        return torso(leather, '<path d="M128 52V150" stroke="#c8a070" stroke-width="1.2" stroke-dasharray="4 3"/>'
                              '<path d="M84 96 Q128 106 172 96" stroke="#c8a070" stroke-width="1.2" stroke-dasharray="4 3" fill="none"/>',
                     extra_over=belt() + pauldrons(leather))
    if kind == "studded":
        return torso(leather, '<rect width="256" height="256" fill="url(#studs)"/>', extra_over=belt() + pauldrons(leather))
    if kind == "hide":
        collar = ('<path d="M74 66 l6 -14 l6 10 l6 -14 l6 12 l8 -12 l6 12 l8 -12 l8 12 l8 -12 l6 12 l8 -12 l6 12 l6 -14 l6 14 '
                  'Q128 92 74 66Z" fill="#9b8a6c" stroke="#3e3224"/>')
        return torso("#7a6a52", '<rect width="256" height="256" fill="url(#fur)"/>', extra_over=collar + belt(138))
    if kind == "chainshirt":
        return torso("#33383b", '<rect width="256" height="256" fill="url(#chain)"/>', extra_over=belt(130))
    if kind == "scale":
        return torso("#5d666b", '<rect width="256" height="256" fill="url(#scales)"/>', extra_over=belt() + pauldrons())
    if kind == "breastplate":
        return torso("url(#steel)", '<path d="M128 52V156" stroke="#eef2f4" stroke-width="2" opacity=".7"/>'
                                    '<path d="M90 70 Q128 84 166 70" stroke="#3d4448" fill="none" stroke-width="1.5"/>',
                     extra_over='<path d="M96 52 L104 46 L110 60Z M160 52 L152 46 L146 60Z" fill="url(#leather)"/>')
    if kind == "halfplate":
        return torso("url(#steel)", '<path d="M128 52V156" stroke="#eef2f4" stroke-width="2" opacity=".7"/>',
                     extra_over=pauldrons() + fauld() + '<path d="M106 46 Q128 40 150 46 L148 54 Q128 48 108 54Z" fill="url(#steelV)" stroke="#2a2e31"/>')
    if kind == "ringmail":
        return torso(leather, '<rect width="256" height="256" fill="url(#rings)"/>', extra_over=belt())
    if kind == "chainmail":
        sleeves = ('<path d="M64 68 L46 120 L60 124 L76 84Z" fill="#33383b" stroke="#15181a"/>'
                   '<path d="M192 68 L210 120 L196 124 L180 84Z" fill="#33383b" stroke="#15181a"/>'
                   '<path d="M46 120 L60 124 L76 84 L64 68Z M210 120 L196 124 L180 84 L192 68Z" fill="url(#chain)"/>')
        skirt = '<path d="M80 146 Q128 158 176 146 L182 166 Q128 176 74 166Z" fill="#33383b" stroke="#15181a"/><path d="M80 146 Q128 158 176 146 L182 166 Q128 176 74 166Z" fill="url(#chain)"/>'
        return torso("#33383b", '<rect width="256" height="256" fill="url(#chain)"/>', extra_under=sleeves + skirt, extra_over=belt(128))
    if kind == "splint":
        return torso(leather, '<rect x="0" y="60" width="256" height="90" fill="url(#splint)"/>', extra_over=pauldrons() + belt(140))
    if kind == "plate":
        trim = f'<path d="{TORSO}" fill="none" stroke="url(#brass)" stroke-width="3"/>'
        return torso("url(#steel)", '<path d="M128 52V156" stroke="#f4f7f8" stroke-width="2.5" opacity=".8"/>'
                                    '<path d="M88 74 Q128 90 168 74" stroke="#3d4448" fill="none" stroke-width="1.5"/>',
                     extra_over=trim + pauldrons() + fauld() +
                     '<path d="M104 44 Q128 36 152 44 L150 56 Q128 48 106 56Z" fill="url(#steelV)" stroke="#2a2e31"/>'
                     '<path d="M60 62 Q64 42 92 46" stroke="url(#brass)" stroke-width="2.5" fill="none"/>'
                     '<path d="M196 62 Q192 42 164 46" stroke="url(#brass)" stroke-width="2.5" fill="none"/>')
    raise ValueError(kind)


# ---------------------------------------------------------------- портреты

PORTRAIT_DEFS = """
<radialGradient id="pbg" cx=".5" cy=".35" r=".8">
  <stop offset="0" stop-color="#3d433f"/><stop offset=".6" stop-color="#1b1f1d"/><stop offset="1" stop-color="#0d0f0e"/></radialGradient>
<radialGradient id="rim" cx=".85" cy=".3" r=".6">
  <stop offset="0" stop-color="#f0b443" stop-opacity=".35"/><stop offset="1" stop-color="#f0b443" stop-opacity="0"/></radialGradient>
<radialGradient id="shade" cx=".35" cy=".35" r=".85">
  <stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>
"""

HEAD = "M84 128 C82 80 174 80 172 128 C172 168 154 198 128 200 C102 198 84 168 84 128Z"


def skin_grad(name, light, dark):
    return (f'<radialGradient id="{name}" cx=".38" cy=".38" r=".75">'
            f'<stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></radialGradient>')


def eyes(iris="#4a6b8a", slit=False, glow=False, y=136):
    out = ""
    for cx in (110, 146):
        pupil = (f'<ellipse cx="{cx}" cy="{y}" rx="1.1" ry="3.4" fill="#111"/>' if slit
                 else f'<circle cx="{cx}" cy="{y}" r="1.7" fill="#111"/>')
        out += (f'<ellipse cx="{cx}" cy="{y}" rx="8" ry="4" fill="#efe8dc"/>'
                f'<circle cx="{cx}" cy="{y}" r="3.6" fill="{iris}"/>{pupil}'
                f'<circle cx="{cx - 1.2}" cy="{y - 1.3}" r=".9" fill="#fff"/>'
                f'<path d="M{cx - 9} {y - 1} Q{cx} {y - 7} {cx + 9} {y - 1}" stroke="#2a1a12" stroke-width="2" fill="none"/>')
        if glow:
            out += f'<circle cx="{cx}" cy="{y}" r="6" fill="{iris}" opacity=".35" filter="url(#blur2)"/>'
    return out


def brows(color, y=124, thick=3.5, angry=False):
    d = 3 if angry else 0
    return (f'<path d="M98 {y + d} Q109 {y - 5} 120 {y - d}" stroke="{color}" stroke-width="{thick}" fill="none" stroke-linecap="round"/>'
            f'<path d="M136 {y - d} Q147 {y - 5} 158 {y + d}" stroke="{color}" stroke-width="{thick}" fill="none" stroke-linecap="round"/>')


def nose(dark, wide=1.0):
    w = 7 * wide
    return (f'<path d="M127 138 L123 160 Q128 {165 + wide} {128 + w} 160" stroke="{dark}" stroke-width="2" fill="none" opacity=".75"/>'
            f'<ellipse cx="{124 - w / 2}" cy="161" rx="2.4" ry="1.6" fill="{dark}" opacity=".6"/>'
            f'<ellipse cx="{132 + w / 2}" cy="161" rx="2.4" ry="1.6" fill="{dark}" opacity=".6"/>')


def mouth(color="#6b3b30", y=178, smile=0):
    return f'<path d="M114 {y} Q128 {y + 4 + smile} 142 {y}" stroke="{color}" stroke-width="2.4" fill="none" stroke-linecap="round"/>'


def ears(skin, dark, kind="round"):
    if kind == "pointed":
        return (f'<path d="M86 124 L52 98 L80 150Z" fill="{skin}" stroke="{dark}" stroke-width="1"/>'
                f'<path d="M170 124 L204 98 L176 150Z" fill="{skin}" stroke="{dark}" stroke-width="1"/>')
    return (f'<ellipse cx="84" cy="140" rx="8" ry="14" fill="{skin}" stroke="{dark}" stroke-width="1"/>'
            f'<ellipse cx="172" cy="140" rx="8" ry="14" fill="{skin}" stroke="{dark}" stroke-width="1"/>')


def portrait(skin_light, skin_dark, clothes, behind="", hair_back="", hair_front="", face_extra="",
             ear_kind="round", iris="#4a6b8a", slit=False, glow=False, brow="#3a2618", wide_nose=1.0,
             front="", head=HEAD, angry=False, smile=0, clothes_extra=""):
    defs = PORTRAIT_DEFS + skin_grad("skin", skin_light, skin_dark)
    body = f"""
<rect width="256" height="320" fill="url(#pbg)"/>
<rect width="256" height="320" fill="url(#rim)"/>
{behind}{hair_back}
<path d="M108 186 L106 238 L150 238 L148 186Z" fill="{skin_dark}"/>
<path d="M24 320 C34 256 78 236 128 232 C178 236 222 256 232 320Z" fill="{clothes}" stroke="#0d0f0e" stroke-width="1.5"/>
{clothes_extra}
{ears("url(#skin)", skin_dark, ear_kind) if ear_kind else ""}
<path d="{head}" fill="url(#skin)"/>
<path d="{head}" fill="url(#shade)"/>
{eyes(iris, slit, glow)}{brows(brow, angry=angry)}{nose(skin_dark, wide_nose)}{mouth(smile=smile)}
{face_extra}{hair_front}{front}
"""
    return svg(256, 320, body, defs)


def human():
    hair = ('<path d="M84 130 C74 76 110 64 130 66 C164 64 186 86 172 132 C168 106 156 94 128 94 C104 94 92 108 84 130Z" fill="#4a2e1c"/>'
            '<path d="M100 92 Q120 84 150 96" stroke="#6a4630" stroke-width="2" fill="none"/>')
    clothes = '#3f4f5c'
    strap = '<path d="M60 262 L196 316" stroke="url(#leather)" stroke-width="12"/><path d="M118 234 L128 252 L138 234" stroke="#2c3740" stroke-width="3" fill="none"/>'
    return portrait("#efc6a2", "#b07a58", clothes, hair_front=hair, front=strap, iris="#5a7a4a", brow="#4a2e1c")


def barbarian():
    head = "M80 126 C78 76 178 76 176 126 C176 170 158 202 128 204 C98 202 80 170 80 126Z"
    hair_back = ('<path d="M76 120 C60 170 60 240 80 270 L100 240 L96 160Z M180 120 C196 170 196 240 176 270 L156 240 L160 160Z" fill="#2b1c12"/>'
                 '<path d="M72 196 l-6 50 M186 196 l6 50" stroke="#8a6238" stroke-width="5"/>')
    hair = ('<path d="M80 128 C70 70 110 54 130 56 C170 54 190 80 176 130 C172 100 150 86 128 88 C104 88 86 104 80 128Z" fill="#2b1c12"/>'
            '<path d="M96 70 Q110 96 104 116 M160 70 Q148 96 154 116" stroke="#1c120b" stroke-width="3" fill="none"/>')
    paint = ('<path d="M98 146 L120 146 L118 152 L100 152Z M136 146 L158 146 L156 152 L138 152Z" fill="#7a2420" opacity=".85"/>'
             '<path d="M150 112 L162 132" stroke="#8a5a40" stroke-width="2"/>')
    beard = '<path d="M98 176 Q128 214 158 176 Q150 200 128 206 Q106 200 98 176Z" fill="#2b1c12"/>'
    fur = ('<path d="M20 320 C26 262 60 236 94 230 l8 10 l8 -8 l8 8 l10 -8 l10 8 l8 -8 l8 8 l8 -10 '
           'C196 236 230 262 236 320Z" fill="#6e5a42" stroke="#2b2117"/>'
           '<path d="M40 300 q10 -14 6 -28 M70 280 q8 -12 4 -22 M200 300 q-10 -14 -6 -28 M180 280 q-8 -12 -4 -22" stroke="#3e3224" stroke-width="2" fill="none"/>')
    return portrait("#d9a173", "#97613c", "#4a3a2a", hair_back=hair_back, hair_front=hair, face_extra=paint + beard,
                    front=fur, head=head, iris="#6a8aa0", brow="#2b1c12", wide_nose=1.3, angry=True)


def dwarf():
    head = "M80 132 C78 84 178 84 176 132 C176 168 158 192 128 194 C98 192 80 168 80 132Z"
    beard = ('<path d="M86 150 C84 200 96 270 128 290 C160 270 172 200 170 150 C160 176 146 186 128 186 C110 186 96 176 86 150Z" fill="#a8582a"/>'
             '<path d="M110 196 Q112 240 120 270 M146 196 Q144 240 136 270 M128 190 V282" stroke="#7a3c18" stroke-width="2.5" fill="none"/>'
             '<rect x="118" y="252" width="20" height="9" rx="2" fill="url(#brass)"/>'
             '<path d="M104 172 Q128 160 152 172 Q140 168 128 172 Q116 168 104 172Z" fill="#8a4620"/>')
    hair = ('<path d="M82 132 C72 86 108 70 128 72 C152 70 186 86 174 132 C170 112 158 98 128 98 C100 98 88 112 82 132Z" fill="#a8582a"/>'
            '<path d="M80 108 Q128 92 176 108 L176 118 Q128 102 80 118Z" fill="url(#leather)"/>')
    armor = '<path d="M24 320 C34 256 78 236 128 232 C178 236 222 256 232 320Z" fill="url(#chain)"/>'
    return portrait("#e7b48e", "#a06a48", "#33383b", hair_front=hair, face_extra=beard, clothes_extra=armor,
                    head=head, iris="#5a4a3a", brow="#8a4620", wide_nose=1.6, angry=True)


def beastkin():
    ears_top = ('<path d="M92 100 L80 40 L120 84Z" fill="#6a5a48" stroke="#2e261c"/><path d="M94 92 L86 54 L112 84Z" fill="#c9907a"/>'
                '<path d="M164 100 L176 40 L136 84Z" fill="#6a5a48" stroke="#2e261c"/><path d="M162 92 L170 54 L144 84Z" fill="#c9907a"/>')
    hair = ('<path d="M84 130 C74 78 112 66 130 68 C166 66 184 90 172 132 L166 112 L158 124 L150 100 L140 116 L128 96 L116 116 L106 100 L98 124 L90 112Z" fill="#6a5a48"/>')
    tufts = ('<path d="M86 150 l-10 6 l10 2 l-8 8 l12 -2 M170 150 l10 6 l-10 2 l8 8 l-12 -2" fill="#6a5a48" stroke="#6a5a48"/>'
             '<path d="M122 172 Q128 176 134 172" stroke="#2a1a12" stroke-width="1.6" fill="none"/>')
    cloak = '<path d="M24 320 C34 256 78 236 128 232 C178 236 222 256 232 320Z" fill="#4a5a3a"/><path d="M96 240 Q128 262 160 240" stroke="#2e3a22" stroke-width="6" fill="none"/>'
    return portrait("#e2b48c", "#a4724e", "#4a5a3a", behind=ears_top, hair_front=hair, face_extra=tufts, front=cloak,
                    ear_kind=None, iris="#d8a830", slit=True, brow="#4a3e30")


def fairy():
    head = "M88 128 C86 82 170 82 168 128 C168 166 152 194 128 196 C104 194 88 166 88 128Z"
    hair_back = '<path d="M84 110 C62 170 70 260 92 300 L128 260 L164 300 C186 260 194 170 172 110Z" fill="#a9c4a6"/>'
    hair = ('<path d="M88 132 C80 80 112 66 130 68 C160 66 180 88 168 134 C162 104 140 92 112 104 C100 112 94 120 88 132Z" fill="#c4d8bc"/>'
            '<path d="M112 72 Q100 100 96 130 M140 70 Q156 92 160 120" stroke="#8aa886" stroke-width="2" fill="none"/>')
    sparks = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#c8f0a0" opacity=".8" filter="url(#blur2)"/>'
                     for x, y, r in [(40, 80, 3), (214, 60, 2.5), (200, 140, 2), (56, 190, 2.5), (226, 220, 2), (30, 140, 1.8)])
    circlet = '<path d="M90 110 Q128 96 166 110" stroke="url(#brass)" stroke-width="2.5" fill="none"/><circle cx="128" cy="102" r="3.5" fill="#7ad0a0"/>'
    tunic = '<path d="M96 240 L128 290 L160 240" stroke="#c9b26a" stroke-width="3" fill="none"/>'
    return portrait("#f4dccb", "#c09a86", "#3e6a48", hair_back=hair_back, hair_front=hair + circlet, behind=sparks,
                    front=tunic, ear_kind="pointed", iris="#58c890", glow=True, brow="#9ab896", head=head, smile=2)


def dragon():
    horns = ('<path d="M100 92 C84 60 70 40 50 36 C66 52 76 74 88 104Z" fill="#d8ccb0" stroke="#5a503e" stroke-width="1.5"/>'
             '<path d="M156 92 C172 60 186 40 206 36 C190 52 180 74 168 104Z" fill="#d8ccb0" stroke="#5a503e" stroke-width="1.5"/>'
             '<path d="M66 46 l6 6 M78 60 l6 4 M190 46 l-6 6 M178 60 l-6 4" stroke="#7a6e58" stroke-width="2"/>')
    hair = ('<path d="M84 130 C76 80 108 70 128 74 C150 70 182 82 172 132 C170 112 152 100 128 102 C106 100 90 112 84 130Z" fill="#1c1a22"/>')
    scales = "".join(f'<path d="M{x} {y} q3 4 6 0" stroke="#7a3a30" stroke-width="1.3" fill="#a4584a" opacity=".7"/>'
                     for x, y in [(90, 150), (96, 156), (90, 160), (98, 164), (160, 150), (154, 156), (160, 160), (152, 164),
                                  (92, 118), (98, 112), (156, 118), (150, 112)])
    robe = ('<path d="M24 320 C34 256 78 236 128 232 C178 236 222 256 232 320Z" fill="#5a1a1c"/>'
            '<path d="M100 236 L128 320 L156 236" fill="#2a0e10" stroke="url(#brass)" stroke-width="3"/>'
            '<path d="M60 260 Q128 246 196 260" stroke="url(#brass)" stroke-width="2" fill="none"/>')
    return portrait("#dcbfa6", "#9a7460", "#5a1a1c", behind=horns, hair_front=hair, face_extra=scales, front=robe,
                    iris="#e0a020", slit=True, glow=True, brow="#1c1a22")


# ---------------------------------------------------------------- гоблин

GOBLIN_SKIN = ("#9bb85a", "#4e6a28")


def goblin_head():
    """Голова гоблина в координатах 0..256, центр (128,128)."""
    return f"""
<path d="M70 120 L6 92 L30 120 L10 130 L74 146Z" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
<path d="M186 120 L250 92 L226 120 L246 130 L182 146Z" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
<path d="M22 106 L64 128 M234 106 L192 128" stroke="#3a5018" stroke-width="2"/>
<path d="M70 120 C64 60 192 60 186 120 C186 170 164 208 128 210 C92 208 70 170 70 120Z" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
<path d="M70 120 C64 60 192 60 186 120 C186 170 164 208 128 210 C92 208 70 170 70 120Z" fill="url(#shade)"/>
<path d="M84 82 l-6 -26 M100 72 l-2 -30 M150 70 l6 -28 M168 80 l12 -22" stroke="#1e2010" stroke-width="2.5"/>
<path d="M88 118 Q104 106 120 120 L118 122 Q104 112 90 122Z M168 118 Q152 106 136 120 L138 122 Q152 112 166 122Z" fill="#2e4014"/>
<ellipse cx="104" cy="132" rx="14" ry="10" fill="#f4e27a"/><ellipse cx="152" cy="132" rx="14" ry="10" fill="#f4e27a"/>
<ellipse cx="104" cy="132" rx="3" ry="8" fill="#151509"/><ellipse cx="152" cy="132" rx="3" ry="8" fill="#151509"/>
<circle cx="100" cy="128" r="2" fill="#fff"/><circle cx="148" cy="128" r="2" fill="#fff"/>
<path d="M90 124 Q104 118 118 126 M166 124 Q152 118 138 126" stroke="#2e4014" stroke-width="2" fill="none"/>
<path d="M126 132 C120 150 112 160 120 166 Q128 170 136 164 C138 158 132 148 126 132Z" fill="#7e9a44" stroke="#2e4014" stroke-width="1.5"/>
<path d="M92 176 Q128 200 164 176 Q128 188 92 176Z" fill="#2a0e0a" stroke="#2e4014" stroke-width="2"/>
<path d="M100 179 l4 8 l4 -6 M114 183 l4 8 l4 -7 M134 183 l4 8 l4 -8 M148 179 l4 7 l4 -8" fill="#efe6c8" stroke="#8a7a50" stroke-width=".8"/>
<circle cx="160" cy="152" r="3.5" fill="#6e8a36"/><circle cx="92" cy="160" r="2.5" fill="#6e8a36"/>
<path d="M150 98 L162 110" stroke="#4e6a28" stroke-width="2"/>"""


def goblin_defs():
    return PORTRAIT_DEFS + skin_grad("gskin", *GOBLIN_SKIN)


# Головные уборы вариантов гоблина (в координатах goblin_head).
GOBLIN_HATS = {
    "goblin": "",
    "goblin-archer": '<path d="M66 118 C58 50 198 50 190 118 C180 84 160 70 128 70 C96 70 76 84 66 118Z" fill="#3e4a26" stroke="#1e2410" stroke-width="2"/>'
                     '<path d="M66 118 C70 140 74 156 80 166 L72 120Z M190 118 C186 140 182 156 176 166 L184 120Z" fill="#3e4a26"/>',
    "goblin-sword": '<path d="M72 104 C70 58 186 58 184 104 L184 112 L72 112Z" fill="url(#iron)" stroke="#1c1f21" stroke-width="2"/>'
                    '<path d="M124 112 L132 112 L131 140 L125 140Z" fill="url(#iron)" stroke="#1c1f21"/><circle cx="96" cy="100" r="3" fill="#cfd6da"/><circle cx="160" cy="100" r="3" fill="#cfd6da"/>',
    "goblin-spear": '<path d="M70 96 Q128 80 186 96 L186 108 Q128 92 70 108Z" fill="#8a2a20" stroke="#3a120c" stroke-width="2"/>'
                    '<path d="M186 100 l18 10 l-4 14 l-10 -16Z" fill="#8a2a20"/>',
}


def goblin_face(variant="goblin"):
    body = f"""
<rect width="256" height="256" fill="url(#pbg)"/><rect width="256" height="256" fill="url(#rim)"/>
<g transform="translate(0 6)">{goblin_head()}{GOBLIN_HATS[variant]}</g>"""
    return svg(256, 256, body, goblin_defs() + NICHE_DEFS)


# Оружие и снаряжение вариантов гоблина (полный рост).
GOBLIN_GEAR = {
    "goblin": '''<path d="M190 264 L218 214 L222 218 L196 268Z" fill="#7a6a5a" stroke="#3a2e22" stroke-width="1.5"/>
  <path d="M205 238 l5 -4 M212 226 l4 -3" stroke="#8a4a20" stroke-width="2.5"/>
  <rect x="182" y="262" width="12" height="16" rx="2" fill="url(#leather)" transform="rotate(30 188 270)"/>
  <path d="M70 284 L62 300 M74 288 L70 304" stroke="#5a3e26" stroke-width="3"/>
  <path d="M46 300 Q60 290 76 304" stroke="#5a3e26" stroke-width="2" fill="none"/>''',
    "goblin-archer": '''<rect x="150" y="196" width="16" height="70" rx="4" fill="url(#leather)" transform="rotate(18 158 230)"/>
  <path d="M162 196 l-4 -16 M168 198 l2 -16 M156 196 l-8 -14" stroke="#c8bfa8" stroke-width="3"/>
  <path d="M66 196 Q30 280 70 360" fill="none" stroke="url(#wood)" stroke-width="6" stroke-linecap="round"/>
  <path d="M66 196 L70 360" stroke="#e8e0c8" stroke-width="1.2"/>
  <path d="M188 268 L214 240" stroke="url(#wood)" stroke-width="3"/><path d="M214 240 l6 -2 l-2 6z" fill="#cfd6da"/>''',
    "goblin-sword": '''<path d="M192 262 L214 214 Q232 206 236 218 L204 272Z" fill="url(#steel)" stroke="#3d4448" stroke-width="1.5"/>
  <path d="M220 226 l4 -3 M210 246 l5 -3" stroke="#8a4a20" stroke-width="2"/>
  <rect x="182" y="262" width="12" height="18" rx="2" fill="url(#leather)" transform="rotate(25 188 270)"/>
  <circle cx="72" cy="272" r="28" fill="#7a5432" stroke="url(#iron)" stroke-width="5"/>
  <circle cx="72" cy="272" r="8" fill="url(#steelV)" stroke="#2a2e31"/>
  <path d="M56 256 L88 288 M88 256 L56 288" stroke="#5a3a20" stroke-width="2" opacity=".6"/>''',
    "goblin-spear": '''<path d="M196 360 L200 96" stroke="url(#wood)" stroke-width="6" stroke-linecap="round"/>
  <path d="M200 64 C208 80 208 92 203 100 L197 100 C192 92 192 80 200 64Z" fill="url(#steel)" stroke="#3d4448"/>
  <rect x="195" y="98" width="10" height="8" fill="url(#iron)"/>
  <path d="M70 284 L62 300 M74 288 L70 304" stroke="#5a3e26" stroke-width="3"/>''',
}


def goblin_full(variant="goblin"):
    body = f"""
<rect width="256" height="384" fill="url(#pbg)"/><rect width="256" height="384" fill="url(#rim)"/>
<rect y="320" width="256" height="64" fill="#1a1d1b"/><rect y="320" width="256" height="64" fill="url(#bricks)"/>
<ellipse cx="128" cy="352" rx="70" ry="12" fill="#000" opacity=".6"/>
<g>
  <path d="M106 280 L94 344 L112 346 L118 290Z M150 280 L162 344 L144 346 L138 290Z" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
  <path d="M88 342 L116 342 L118 352 L82 352Z M140 342 L168 342 L174 352 L138 352Z" fill="#3a2a1c"/>
  <path d="M92 204 C84 240 92 280 104 292 L152 292 C164 280 172 240 164 204 Q128 190 92 204Z" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
  <path d="M96 210 C92 236 98 262 104 268 L152 268 C158 262 164 236 160 210 Q128 200 96 210Z" fill="#5a3e26" stroke="#2a1c10" stroke-width="2"/>
  <path d="M102 222 L154 252 M100 246 L130 262" stroke="#2a1c10" stroke-width="1.6"/>
  <path d="M98 266 L158 266 L166 306 L146 296 L136 312 L124 298 L112 312 L104 296 L90 306Z" fill="#6a4a2e" stroke="#2a1c10" stroke-width="2"/>
  <path d="M94 212 C78 230 72 254 70 276 L82 280 C86 258 94 240 104 226Z" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
  <path d="M162 212 C180 228 190 248 194 264 L182 270 C176 252 168 238 154 226Z" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
  <circle cx="76" cy="280" r="9" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
  <circle cx="188" cy="268" r="9" fill="url(#gskin)" stroke="#2e4014" stroke-width="2"/>
  {GOBLIN_GEAR[variant]}
</g>
<g transform="translate(36 6) scale(.72)">{goblin_head()}{GOBLIN_HATS[variant]}</g>"""
    defs = goblin_defs() + NICHE_DEFS
    return svg(256, 384, body, defs)


# ---------------------------------------------------------------- заглушки монстров
# Пока у вида нет своей картинки, используется силуэт по типу (зверь, нежить, элементаль).
PH_SHAPES = {
    "beast": '<path d="M70 150 L84 86 L108 120 L148 120 L172 86 L186 150 C186 196 160 214 128 214 C96 214 70 196 70 150Z" fill="#2a2016" stroke="#6e5634" stroke-width="2"/>'
             '<circle cx="108" cy="150" r="5" fill="#d6a64c"/><circle cx="148" cy="150" r="5" fill="#d6a64c"/><path d="M118 186 L128 194 L138 186" stroke="#6e5634" stroke-width="2" fill="none"/>',
    "undead": '<path d="M84 140 C84 96 172 96 172 140 C172 166 160 176 156 190 L100 190 C96 176 84 166 84 140Z" fill="#2a2016" stroke="#6e5634" stroke-width="2"/>'
              '<circle cx="110" cy="146" r="11" fill="#0b0805"/><circle cx="146" cy="146" r="11" fill="#0b0805"/><path d="M106 200 V214 M118 200 V216 M130 200 V216 M142 200 V214" stroke="#6e5634" stroke-width="3"/>',
    "elemental": '<path d="M76 196 L88 118 L120 90 L162 100 L184 150 L170 204 L112 214Z" fill="#2a2016" stroke="#6e5634" stroke-width="2"/>'
                 '<path d="M110 120 L126 150 L116 176 M150 128 L140 160" stroke="#6e5634" stroke-width="2" fill="none"/><circle cx="128" cy="150" r="6" fill="#d6a64c" opacity=".8"/>',
}


def ph_face(kind):
    body = f"""<rect width="256" height="256" fill="url(#pbg)"/><rect width="256" height="256" fill="url(#rim)"/>
{PH_SHAPES[kind]}
<text x="128" y="238" text-anchor="middle" font-family="Georgia, serif" font-size="14" letter-spacing="3" fill="#7d6c52">ПОРТРЕТ СКОРО</text>"""
    return svg(256, 256, body, PORTRAIT_DEFS)


def ph_full(kind):
    body = f"""<rect width="256" height="384" fill="url(#pbg)"/><rect width="256" height="384" fill="url(#rim)"/>
<g transform="translate(0 70)">{PH_SHAPES[kind]}</g>
<text x="128" y="350" text-anchor="middle" font-family="Georgia, serif" font-size="14" letter-spacing="3" fill="#7d6c52">ПОРТРЕТ СКОРО</text>"""
    return svg(256, 384, body, PORTRAIT_DEFS)


# ---------------------------------------------------------------- сборка

ITEMS = {
    "spear": spear, "mace": mace, "warhammer": warhammer, "sword": sword, "rapier": rapier,
    "greatsword": greatsword, "shortbow": shortbow, "longbow": longbow, "arrows": arrows, "shield": shield,
}
ARMOR = ["leather", "hide", "chainmail"]  # базовая броня каждой группы
RACES = {"human": human, "barbarian": barbarian, "dwarf": dwarf, "beastkin": beastkin, "fairy": fairy, "dragon": dragon}


def write(rel, text):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def main():
    for name, fn in ITEMS.items():
        write(f"items/{name}.svg", pedestal(fn()))
    for kind in ARMOR:
        write(f"items/armor-{kind}.svg", pedestal(armor_item(kind), stand=True).replace("</defs>", ARMOR_DEFS + "</defs>", 1))
    for name, fn in RACES.items():
        art = fn()
        if "url(#chain)" in art and 'id="chain"' not in art:
            art = art.replace("</defs>", ARMOR_DEFS + "</defs>", 1)
        write(f"races/{name}.svg", art)
    for kind in PH_SHAPES:
        write(f"monsters/ph-{kind}-face.svg", ph_face(kind))
        write(f"monsters/ph-{kind}-full.svg", ph_full(kind))
    for v in GOBLIN_GEAR:
        write(f"monsters/{v}-face.svg", goblin_face(v))
        write(f"monsters/{v}-full.svg", goblin_full(v))


if __name__ == "__main__":
    main()
