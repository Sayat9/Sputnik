"""Собирает bestiary.html — отдельный справочник монстров из ../campaign/rules.md.
Запуск: python3 tools/gen_bestiary.py (из папки app). Картинки берутся из assets/ как в приложении."""
import html, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
RULES = os.path.join(APP, "..", "campaign", "rules.md")
SRC = open(os.path.join(APP, "index.html"), encoding="utf-8").read()
rules = open(RULES, encoding="utf-8").read()

# Монстры из данных приложения: id, зона, редкость, имя, заглушка-картинка.
MON = []
for m in re.finditer(r'\{ id: "([a-z-]+)", zone: "([a-z]+)", rare: (true|false)[^\n]*?name: "([^"]+)"[^\n]*', SRC):
    ph = re.search(r'ph: "([a-z]+)"', m.group(0))
    MON.append(dict(id=m.group(1), zone=m.group(2), rare=m.group(3) == "true", name=m.group(4), ph=ph.group(1) if ph else None))
RASTER = set(re.search(r'const RASTER = new Set\(\[([^\]]*)\]', SRC).group(1).replace('"', "").replace(" ", "").split(","))
def face(m):
    if m["ph"]: return f"assets/monsters/ph-{m['ph']}-face.svg"
    p = f"monsters/{m['id']}-face"
    return f"assets/{p}.{'webp' if p in RASTER else 'svg'}"

ZONES = [("goblin", "Гоблины", "зона гоблинов · северо-запад"), ("beast", "Звери", "зона зверей · юго-запад"),
         ("undead", "Нежить", "зона нежити · северо-восток"), ("stone", "Элементали", "зона элементов · юго-восток")]

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)\*(?!\w)", r"<i>\1</i>", t)
    return t

def md(block):
    out, lines, i = [], block.strip("\n").split("\n"), 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip(): i += 1; continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells): rows.append(cells)
                i += 1
            head, body = rows[0], rows[1:]
            out.append('<div class="tbl"><table><thead><tr>' + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
                       + "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</tbody></table></div>")
            continue
        if re.match(r"\s*- ", ln):
            items = []
            while i < len(lines) and re.match(r"\s*- ", lines[i]):
                items.append(re.sub(r"^\s*- ", "", lines[i])); i += 1
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>")
            continue
        m = re.fullmatch(r"\*\*(.+?)\*\*", ln.strip())
        if m:
            name = m.group(1)
            kind = "pas" if name.endswith("(П)") else "act" if name.endswith("(А)") else ""
            out.append(f'<h4 class="{kind}">{inline(name)}</h4>'); i += 1; continue
        out.append(f"<p>{inline(ln)}</p>"); i += 1
    return "\n".join(out)

# Разделы монстров из rules.md.
sec = rules[rules.index("## Монстры и эссенции"):]
sec = sec[:sec.index("\n## ", 5)]
intro_raw = sec[sec.index("\n") + 1: sec.index("\n### ")]
blocks = {}
for part in re.split(r"\n### ", sec)[1:]:
    title, body = part.split("\n", 1)
    blocks[title.strip()] = body

cards, idx = [], []
for zid, zname, zdesc in ZONES:
    ms = [m for m in MON if m["zone"] == zid]
    idx.append(f'<div class="zone-idx"><span class="zl">{zname}</span><div class="faces">' + "".join(
        f'<a href="#{m["id"]}" class="fchip" data-zone="{zid}" data-rare="{int(m["rare"])}"><img src="{face(m)}" alt="" loading="lazy"><span>{m["name"]}</span></a>' for m in ms) + "</div></div>")
    cards.append(f'<h2 class="zone-h" data-zone="{zid}" id="z-{zid}">{zname}<small>{zdesc}</small></h2>')
    for m in ms:
        body = blocks.get(m["name"], "")
        lvl = re.search(r"\*\*Уровень:\*\*\s*(\d+)", body)
        body = re.sub(r"\*\*Имя:\*\*.*\n", "", body)
        body = re.sub(r"\*\*Уровень:\*\*.*\n", "", body)
        habit = re.search(r"\*\*Обитает:\*\*\s*(.+)", body)
        body = re.sub(r"\*\*Обитает:\*\*.*\n", "", body)
        stat_line = re.search(r"\n([^\n|*-][^\n]*Опасность[^\n]*)", body)
        tags = [f'<span class="tag cls">{lvl.group(1) if lvl else 9} класс</span>',
                f'<span class="tag {"rare" if m["rare"] else "std"}">{"редкий" if m["rare"] else "обычный"}</span>']
        cards.append(f'''<article class="mon" id="{m["id"]}" data-zone="{zid}" data-rare="{int(m["rare"])}" data-name="{m["name"].lower()}">
  <header><img class="face" src="{face(m)}" alt="{m["name"]}" loading="lazy">
    <div class="hd"><h3>{m["name"]}</h3><div class="tags">{"".join(tags)}</div>
    {f'<p class="habit">{inline(habit.group(1))}</p>' if habit else ""}</div></header>
  <div class="body">{md(body)}</div>
</article>''')

page = f'''<title>Бестиарий Рафдонии</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=JetBrains+Mono:wght@400;600&family=Kelly+Slab&family=Cormorant+SC:wght@500;700&display=swap">
<style>
/* Один тёмный мир, как в приложении: свиток мастера — указатель лиц сверху, ниже карточки по зонам. */
:root {{
  color-scheme: dark;
  --bg: #120E09; --panel: #1C160F; --panel2: #241C13; --line: #4A3A26; --text: #E8DCC6; --muted: #A8977C;
  --gold: #D6A64C; --gold-hi: #F0C979; --rare: #C9A2FF; --pas: #7FB35A; --act: #E0814F;
  --f-display: "Kelly Slab", Georgia, serif; --f-fancy: "Cormorant SC", Georgia, serif;
  --f-body: "Alegreya Sans", system-ui, sans-serif; --f-data: "JetBrains Mono", ui-monospace, monospace;
}}
html {{ background: var(--bg); }}
body {{ background: var(--bg); color: var(--text); font: 400 16px/1.5 var(--f-body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 60px; }}
.wrap {{ max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }}
.top h1 {{ font: 400 34px/1.05 var(--f-display); color: var(--gold-hi); margin: 0; text-wrap: balance; }}
.eyebrow {{ font: 700 12px/1 var(--f-fancy); letter-spacing: .2em; text-transform: uppercase; color: var(--gold); }}
.top p {{ color: var(--muted); margin: 8px 0 0; max-width: 65ch; }}
.intro {{ border: 1px solid var(--line); border-radius: 6px; background: var(--panel); padding: 12px 14px; font-size: 14.5px; color: var(--muted); }}
.intro summary {{ cursor: pointer; color: var(--gold); font: 700 13px var(--f-fancy); letter-spacing: .12em; text-transform: uppercase; }}
.intro p {{ margin: 8px 0 0; }}
.bar {{ position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding-block: 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--line); }}
body::before {{ content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }}
.bar input {{ width: 100%; box-sizing: border-box; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; color: var(--text); font: 16px var(--f-body); padding: 9px 12px; }}
.bar input:focus-visible, .chip:focus-visible, .fchip:focus-visible {{ outline: 2px solid var(--gold); outline-offset: 2px; }}
.chips {{ display: flex; flex-wrap: wrap; gap: 6px; }}
.chip {{ background: var(--panel); border: 1px solid var(--line); color: var(--muted); border-radius: 999px; padding: 5px 12px; font: 600 13px var(--f-body); cursor: pointer; }}
.chip[aria-pressed="true"] {{ background: var(--gold); color: #1d140a; border-color: var(--gold-hi); }}
.zone-idx {{ display: flex; flex-direction: column; gap: 6px; }}
.zl {{ font: 700 12px var(--f-fancy); letter-spacing: .16em; text-transform: uppercase; color: var(--gold); }}
.faces {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }}
.fchip {{ display: flex; flex-direction: column; align-items: center; gap: 4px; text-decoration: none; color: var(--text); font-size: 12px; text-align: center; line-height: 1.15; }}
.fchip img {{ width: 100%; max-width: 72px; aspect-ratio: 1; border-radius: 50%; border: 1px solid var(--line); object-fit: cover; background: #0F0C08; }}
.fchip[data-rare="1"] img {{ border-color: var(--rare); }}
.zone-h {{ font: 400 26px/1.1 var(--f-display); color: var(--gold-hi); margin: 14px 0 0; display: flex; flex-direction: column; gap: 2px; scroll-margin-top: 120px; }}
.zone-h small {{ font: 500 13px var(--f-fancy); letter-spacing: .12em; color: var(--muted); text-transform: uppercase; }}
.mon {{ border: 1px solid var(--line); border-radius: 8px; background: var(--panel); overflow: hidden; scroll-margin-top: 120px; }}
.mon header {{ display: flex; gap: 14px; align-items: center; padding: 14px; background: var(--panel2); border-bottom: 1px solid var(--line); }}
.mon .face {{ width: 84px; height: 84px; flex: none; border-radius: 6px; border: 1px solid var(--line); object-fit: cover; background: #0F0C08; }}
.mon[data-rare="1"] .face {{ border-color: var(--rare); }}
.hd {{ min-width: 0; display: flex; flex-direction: column; gap: 6px; }}
.mon h3 {{ font: 400 24px/1.05 var(--f-display); color: var(--gold-hi); margin: 0; }}
.tags {{ display: flex; flex-wrap: wrap; gap: 5px; }}
.tag {{ font: 600 11px/1 var(--f-data); text-transform: uppercase; letter-spacing: .05em; padding: 4px 7px; border-radius: 4px; border: 1px solid var(--line); color: var(--muted); }}
.tag.cls {{ color: var(--gold); border-color: var(--gold); }}
.tag.rare {{ color: var(--rare); border-color: var(--rare); }}
.habit {{ margin: 0; font-size: 14px; color: var(--muted); }}
.body {{ padding: 4px 14px 14px; min-width: 0; }}
.body p {{ margin: 8px 0; }}
.body h4 {{ font: 700 13px/1.2 var(--f-fancy); letter-spacing: .14em; text-transform: uppercase; color: var(--gold); margin: 16px 0 6px; padding-top: 10px; border-top: 1px dashed var(--line); }}
.body h4.pas, .body h4.act {{ font: 400 18px/1.2 var(--f-display); letter-spacing: 0; text-transform: none; border-top: 0; padding-top: 0; }}
.body h4.pas {{ color: var(--pas); }} .body h4.act {{ color: var(--act); }}
.body ul {{ margin: 4px 0; padding-left: 20px; }} .body li {{ margin: 3px 0; }}
.body b {{ color: #F2E6CE; }}
.tbl {{ overflow-x: auto; margin: 8px 0; }}
table {{ border-collapse: collapse; width: 100%; font: 14px var(--f-data); font-variant-numeric: tabular-nums; }}
th {{ font: 700 12px var(--f-fancy); letter-spacing: .12em; color: var(--gold); padding: 6px 4px; border-bottom: 1px solid var(--line); }}
td {{ text-align: center; padding: 6px 4px; }}
.empty {{ color: var(--muted); text-align: center; padding: 30px 0; }}
@media (max-width: 420px) {{ .mon .face {{ width: 68px; height: 68px; }} .top h1 {{ font-size: 28px; }} }}
@media (prefers-reduced-motion: no-preference) {{ html {{ scroll-behavior: smooth; }} }}
</style>
<div class="wrap">
  <div class="top"><span class="eyebrow">Выживание за варвара · 1 этаж</span><h1>Бестиарий Рафдонии</h1>
    <p>Справочник мастера: все 16 монстров 9-го класса — статы, поведение, атаки и эссенции. Портреты, которых ещё нет, заменены силуэтами.</p></div>
  <details class="intro"><summary>Как устроены монстры и эссенции</summary>{md(intro_raw)}</details>
  <div class="bar">
    <input id="q" type="search" placeholder="Найти монстра по имени…" autocomplete="off" aria-label="Поиск по имени">
    <div class="chips" role="group" aria-label="Фильтр">
      <button class="chip" data-f="all" aria-pressed="true">Все</button>
      {"".join(f'<button class="chip" data-f="{z}" aria-pressed="false">{n}</button>' for z, n, _ in ZONES)}
      <button class="chip" data-f="rare" aria-pressed="false">Только редкие</button>
    </div>
  </div>
  {"".join(idx)}
  {"".join(cards)}
  <p class="empty" id="empty" hidden>Никого не нашлось. Сбрось фильтр или поиск.</p>
</div>
<script>
const q = document.getElementById("q"), chips = [...document.querySelectorAll(".chip")];
let zone = "all", rareOnly = false;
function apply() {{
  const s = q.value.trim().toLowerCase(); let shown = 0;
  document.querySelectorAll(".mon").forEach(m => {{
    const ok = (zone === "all" || m.dataset.zone === zone) && (!rareOnly || m.dataset.rare === "1") && (!s || m.dataset.name.includes(s));
    m.hidden = !ok; if (ok) shown++;
  }});
  document.querySelectorAll(".zone-h").forEach(h => {{ h.hidden = ![...document.querySelectorAll(`.mon[data-zone="${{h.dataset.zone}}"]`)].some(m => !m.hidden); }});
  document.querySelectorAll(".fchip").forEach(f => {{ f.hidden = (zone !== "all" && f.dataset.zone !== zone) || (rareOnly && f.dataset.rare !== "1"); }});
  document.querySelectorAll(".zone-idx").forEach(z => {{ z.hidden = ![...z.querySelectorAll(".fchip")].some(f => !f.hidden); }});
  document.getElementById("empty").hidden = shown > 0;
}}
chips.forEach(c => c.addEventListener("click", () => {{
  if (c.dataset.f === "rare") {{ rareOnly = !rareOnly; c.setAttribute("aria-pressed", rareOnly); }}
  else {{ zone = c.dataset.f; chips.filter(x => x.dataset.f !== "rare").forEach(x => x.setAttribute("aria-pressed", x === c)); }}
  apply();
}}));
q.addEventListener("input", apply);
</script>
'''
open(os.path.join(APP, "bestiary.html"), "w", encoding="utf-8").write(page)
print(len(MON), "монстров,", sum(1 for m in MON if blocks.get(m["name"])), "с описанием из rules.md")
