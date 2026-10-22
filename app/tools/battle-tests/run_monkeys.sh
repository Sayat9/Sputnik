#!/bin/bash
# usage: run_monkeys.sh <seed-base>; результаты — в $OUT (по умолчанию /tmp/battle-monkeys)
cd "$(dirname "$0")"; OUT=${OUT:-/tmp/battle-monkeys}; mkdir -p "$OUT"; rm -f "$OUT"/run*.txt
B=${1:-100}
declare -a SCS=(
'{"list":["goblin","goblin","goblin"],"zone":"goblin"}'
'{"list":["wolf","wolf"],"zone":"beast","ambush":true,"heroes":["barb","beast","fairy","archer"]}'
'{"list":["dark-bear"],"zone":"undead","heroes":["barb2","archer","dwarf","fairy"]}'
'{"list":["stone-guardian"],"zone":"stone","heroes":["barb2","archer","dwarf","fairy"],"level":2}'
'{"list":["skeleton-archer","skeleton"],"zone":"undead","heroes":["dwarf","fairy","beast"]}'
'{"list":["living-stone","green-boulder"],"zone":"stone","dark":true,"heroes":["barb2","archer","fairy"]}'
'{"list":["goblin","goblin","goblin","goblin","goblin"],"zone":"goblin","floor":2,"heroes":["barb2","archer","fairy","beast"]}'
'{"list":["zombie","skeleton","skeleton","skeleton-archer"],"zone":"undead","floor":2,"heroes":["barb2","dwarf","fairy"]}'
)
for i in 0 1 2 3 4 5 6 7; do
  timeout 560 node bui_monkey.js $((B+i)) "${SCS[$i]}" > "$OUT/run$i.txt" 2>&1 &
done
wait
for f in "$OUT"/run*.txt; do tail -1 "$f" | cut -c1-400; done
