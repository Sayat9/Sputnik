#!/bin/bash
# usage: run_monkeys.sh <seed-base>
cd "$(dirname "$0")"; mkdir -p mk; rm -f mk/*.txt
B=${1:-100}
declare -a SCS=(
'{"list":["goblin","goblin","goblin"],"zone":"goblin"}'
'{"list":["wolf","wolf"],"zone":"beast","ambush":true,"heroes":["barb","beast","fairy","archer"]}'
'{"list":["dark-bear"],"zone":"undead","heroes":["barb2","archer","dwarf","fairy"]}'
'{"list":["stone-guardian"],"zone":"stone","heroes":["barb2","archer","dwarf","fairy"],"level":2}'
'{"list":["skeleton-archer","skeleton"],"zone":"undead","heroes":["dwarf","fairy","beast"]}'
'{"list":["living-stone","green-boulder"],"zone":"stone","dark":true,"heroes":["barb2","archer","fairy"]}'
)
for i in 0 1 2 3 4 5; do
  timeout 560 node bui_monkey.js $((B+i)) "${SCS[$i]}" > mk/run$i.txt 2>&1 &
done
wait
