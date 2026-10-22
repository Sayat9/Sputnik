#!/bin/bash
# Случайные бои через настоящий интерфейс с эссенциями 2 этажа у героев. usage: run_monkeys_ess2.sh <seed-base> [число запусков]
cd "$(dirname "$0")"; OUT=${OUT:-/tmp/battle-monkeys}; mkdir -p "$OUT"; rm -f "$OUT"/ess2_*.txt
B=${1:-100}; N=${2:-6}
for i in $(seq 0 $((N-1))); do
  SC=$(python3 - "$((B+i))" <<'PY'
import json, random, sys
r = random.Random(int(sys.argv[1]))
ESS = ["goblin-shaman","goblin-assassin","goblin-trapper","goblin-elder","hobgoblin-brute","hobgoblin-thrower","hobgoblin-driver","hobgoblin-shield","goblin-king","goblin-bomber","goblin-thief",
       "horned-hare","swamp-toad","burrower","crow","dire-wolf","web-spider","werewolf","giant-mole","swamp-fang","spider-queen","blackwing",
       "grey-shade","morok","whisperer","mirror-dead","faceless-ringer","dust-crawler","bone-hound","gravedigger","plague-fat","ash-spirit","bone-knight","corpse-eater","ash-wraith"]
NEED = {"horned-hare":"beast","blackwing":"beast","hobgoblin-thrower":"beast","bone-knight":"barb2","hobgoblin-brute":"dwarf","goblin-assassin":"fairy"}
heroes = r.sample(["barb2","beast","fairy","dwarf","archer"], r.choice([3,4]))
ess = [[] for _ in heroes]; bag = {}
for e in r.sample(ESS, len(heroes) + 2):
    need = NEED.get(e)
    if need and need not in heroes: continue
    i = heroes.index(need) if need else r.randrange(len(heroes))
    if not ess[i]: ess[i] = [e]
for i, h in enumerate(heroes):
    if "hobgoblin-thrower" in ess[i]: bag[i] = ["spear", "spear"]
    if not ess[i]: ess[i] = [r.choice(ESS)]
zone = r.choice(["goblin","beast","undead","stone"])
mons = {"goblin":["goblin","goblin-archer","goblin-sword","goblin-spear"],"beast":["wolf","fox","mouse","bat"],"undead":["zombie","skeleton","skeleton-archer","ghoul"],"stone":["living-stone","pixie","wisp","green-boulder"]}[zone]
lst = [r.choice(mons) for _ in range(r.choice([2,3,4]))]
print(json.dumps({"list": lst, "zone": zone, "heroes": heroes, "ess": ess, "bag": bag, "ambush": r.random() < .2, "level": r.choice([1,2,3])}, ensure_ascii=False))
PY
)
  timeout 560 node bui_monkey.js $((B+i)) "$SC" > "$OUT/ess2_$i.txt" 2>&1 &
done
wait
for f in "$OUT"/ess2_*.txt; do tail -1 "$f" | cut -c1-600; done
