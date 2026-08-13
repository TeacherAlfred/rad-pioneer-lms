import type { ConceptRefRow, ModuleContent, ScheduleRow } from "./types";

export const WORKSHOP_TITLE = "Code the Block";
export const WORKSHOP_TAGLINE =
  "Minecraft Education Coding Workshop — Ages 8–16 · Blocks & Python side by side · You choose the project";

export const HOW_IT_WORKS =
  "We're not telling you exactly what to build — we're teaching you coding IDEAS (like loops and if-statements). You decide what project to make with them! Use this guide anytime you get stuck.";

export const BLOCKS_VS_PYTHON = {
  title: "Blocks vs Python — What's the Difference?",
  body: "Blocks (MakeCode) let you snap coding pieces together like puzzle pieces — great for seeing how a program is structured. Python is the same logic, but typed out as real code, the way professional programmers write it. Every project in this guide shows BOTH side by side, so you can see how a block turns into a line of Python.",
  tip: "If you can build it in Blocks first, switching to Python gets much easier — you already know what the code should DO.",
};

export const SCHEDULE: ScheduleRow[] = [
  { time: "10:00 – 10:30", segment: "Free Build", detail: "Explore Minecraft Education — no coding yet. Free play + late arrivals." },
  { time: "10:30 – 11:00", segment: "Teach: BUILD (Beginner)", detail: "Agent Tower / Staircase Builder — loops & sequencing, blocks + Python side by side." },
  { time: "11:00 – 11:30", segment: "Teach: GAME (Beginner)", detail: "Chat-Command Mini-Game — events, loops, timing." },
  { time: "11:30 – 11:45", segment: "Break", detail: "" },
  { time: "11:45 – 12:30", segment: "Go Wild!", detail: "Choose Build or Game (beginner or advanced). Use this guide to help yourself." },
  { time: "This week", segment: "Take-Home", detail: "Story & Pattern/Pixel-Art projects — same guide, work at your own pace." },
];

export const QUICK_REFERENCE: ConceptRefRow[] = [
  { concept: "Sequence", meaning: "Steps run one after another, in order.", example: "Agent moves, THEN places a block." },
  { concept: "Loop", meaning: "Repeats actions without retyping them.", example: "repeat 10 times / for i in range(10)" },
  { concept: "Variable", meaning: "A named box that stores a value that can change.", example: "score = 0, width = 5" },
  { concept: "Conditional (if/else)", meaning: "Code makes a decision based on a condition.", example: "if score >= 5: ... else: ..." },
  { concept: "Event", meaning: "Code that waits and reacts to something happening.", example: "on chat command, on block hit" },
  { concept: "Array / List", meaning: "A list of values stored together, often looped through.", example: 'pattern = ["R","R","W"]' },
  { concept: "Function", meaning: "A named, reusable chunk of code you can call anytime.", example: "def place_row(): ..." },
];

export const REMEMBER =
  'There\'s no single "right" project. Pick something YOU want to build, then use these concepts as your toolkit. Stuck? Try explaining out loud what you want the Agent to do, step by step — that\'s basically writing code!';

export const MODULES: ModuleContent[] = [
  {
    id: "build",
    icon: "🧱",
    title: "BUILD",
    subtitle: "Agent Tower / Staircase Builder",
    when: "workshop",
    coreConcept: {
      name: "LOOPS",
      description:
        'A loop repeats a set of actions without you having to copy-paste them over and over. Instead of writing "move, place, move, place" 20 times, a loop does it for you.',
    },
    tracks: {
      beginner: {
        goal: "Make your Agent build a straight wall or staircase on its own.",
        instructions: [
          "Get your Agent to follow you: teleport it to your location.",
          "Load blocks into its inventory (pick any block you like!).",
          "Tell it to place a block and move forward — then repeat that a set number of times using a loop.",
        ],
        code: {
          blocks: `on chat command "build"
  agent teleport to player
  agent set item: Stone x 64, slot 1
  agent set slot: 1
  repeat 10 times
    agent place: down
    agent move: forward, 1`,
          python: `def on_chat(command):
    if command == "build":
        agent.teleport_to_player()
        agent.set_item(STONE, 64, 1)
        agent.set_slot(1)
        for i in range(10):
            agent.place(DOWN)
            agent.move(FORWARD, 1)
player.on_chat("build", on_build)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt:
              "Make your wall exactly 15 blocks long, and swap Stone for a block you like better.",
          },
          {
            tier: 2,
            prompt:
              "Combine what you just changed: make the Agent go UP one block every time it places, instead of just placing a flat wall — now it's a staircase! Hint: add agent.move(UP, 1) inside the loop.",
          },
          {
            tier: 3,
            prompt:
              "Challenge: build the letter L using only what you've learned (loops + move + place) — no new blocks needed. Plan out the moves on paper first, THEN code it.",
          },
        ],
      },
      advanced: {
        goal: "Build a full mini-house — walls + roof — with adjustable size and no overwriting.",
        instructions: [
          "Use VARIABLES for width, depth and height so you can change the house size in one place.",
          "Use NESTED LOOPS — a loop inside a loop — to build each wall (loop across) then repeat for each row (loop up).",
          'Use an IF statement to check "is this spot empty?" (agent.inspect) before placing, so you don\'t waste blocks.',
        ],
        code: {
          blocks: `set width to 5
set height to 4
repeat height times
  repeat width times
    if agent detect: forward
      agent turn: right
    else
      agent place: forward
      agent move: forward, 1
  agent move: up, 1`,
          python: `width = 5
height = 4
for row in range(height):
    for col in range(width):
        if agent.detect(FORWARD):
            agent.turn(TurnDirection.RIGHT)
        else:
            agent.place(FORWARD)
            agent.move(FORWARD, 1)
    agent.move(UP, 1)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt: "Change width and height to build a bigger or smaller house footprint.",
          },
          {
            tier: 2,
            prompt:
              "Add a third variable called depth and a second nested loop, so your Agent builds a full rectangular room — 4 walls, not just 1.",
          },
          {
            tier: 3,
            prompt:
              "Challenge: using only variables and loops you already know, make your Agent build a real staircase that's height steps tall AND width blocks wide at every step. Plan first — what changes every loop, and what stays the same?",
          },
        ],
      },
    },
  },
  {
    id: "game",
    icon: "🎮",
    title: "GAME",
    subtitle: "Chat-Command Mini-Game",
    when: "workshop",
    coreConcept: {
      name: "EVENTS",
      description:
        "An event is something that triggers your code — typing a chat command, hitting a block, walking somewhere. Instead of code running top-to-bottom once, it waits and reacts.",
    },
    tracks: {
      beginner: {
        goal: "A chat command that starts a countdown and teleports you to a start point.",
        instructions: [
          'Create an on chat command called "start".',
          "Teleport the player to a starting position and give them an item.",
          "Use a loop with a pause inside it to count down out loud in chat: 3... 2... 1... GO!",
        ],
        code: {
          blocks: `on chat command "start"
  teleport player to: (x, y, z)
  say "Get ready!"
  repeat with i from 3 to 1
    say i
    pause 1000 ms
  say "GO!"`,
          python: `def on_start(command):
    player.teleport(pos(0, 64, 0))
    player.say("Get ready!")
    for i in [3, 2, 1]:
        player.say(str(i))
        pause(1000)
    player.say("GO!")
player.on_chat("start", on_start)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt: "Change the countdown numbers (start from 5 instead of 3) and the wait time.",
          },
          {
            tier: 2,
            prompt:
              "Make the countdown speed up — each number should pause for LESS time than the one before it (hint: use 3 different pause values instead of one).",
          },
          {
            tier: 3,
            prompt:
              "Challenge: design your own chat-command opener — a new command word, a new teleport spot, and a countdown style of your own (fast, slow, silly messages). You only need on_chat, say and pause — the plan is all yours.",
          },
        ],
      },
      advanced: {
        goal: "Add scorekeeping and a win/lose condition triggered by something the player does.",
        instructions: [
          "Add a SCORE variable that starts at 0.",
          "Use an event like onBlockHit or onArrowHit so hitting a target adds to the score.",
          "Use an IF/ELSE to check a win condition (e.g. score reached 5) and end the game with a message.",
        ],
        code: {
          blocks: `set score to 0
on block hit
  change score by 1
  say "Score: " + score
  if score >= 5
    say "YOU WIN!"
  else
    say "Keep going!"`,
          python: `score = 0
def on_hit(block, face, entity):
    global score
    score += 1
    player.say("Score: " + str(score))
    if score >= 5:
        player.say("YOU WIN!")
    else:
        player.say("Keep going!")
player.on_block_hit(on_hit)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt: "Change the win score from 5 to 10, and change the win / keep-going messages.",
          },
          {
            tier: 2,
            prompt:
              "Add a LOSE condition too: if the player hits a different kind of block (or presses a different key), subtract a point instead of adding one.",
          },
          {
            tier: 3,
            prompt:
              "Challenge: combine the Beginner countdown with this scoring system so the player only has 15 seconds to hit the target 5 times — if the timer runs out first, they lose. You already know loops, pause, events and if/else — the only new part is putting them together in the right order.",
          },
        ],
      },
    },
  },
  {
    id: "story",
    icon: "📖",
    title: "STORY",
    subtitle: "Interactive NPC Dialogue",
    when: "take-home",
    coreConcept: {
      name: "CONDITIONALS (if / else)",
      description:
        "Your code makes decisions based on what the player types or does, just like a choose-your-own-adventure book.",
    },
    tracks: {
      beginner: {
        goal: 'Use an on chat command to make a sign or NPC "talk" — it says a sequence of messages when you type "talk".',
        instructions: [],
        code: {
          blocks: `on chat command "talk"
  say "Welcome, traveler!"
  say "I have been waiting for you."`,
          python: `def on_talk(command):
    player.say("Welcome, traveler!")
    player.say("I have been waiting for you.")
player.on_chat("talk", on_talk)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt: "Change the NPC's two messages to something in your own words.",
          },
          {
            tier: 2,
            prompt:
              "Add a THIRD message to the sequence, and put a pause between each one so it feels like the NPC is really talking, not machine-gunning text.",
          },
          {
            tier: 3,
            prompt:
              'Challenge: give your NPC two different commands with completely different personalities — a "talk" command AND a "wave" command that say totally different things, using two separate on_chat handlers like the one you already wrote.',
          },
        ],
      },
      advanced: {
        goal:
          'Make the story BRANCH: the player types "yes" or "no" and gets a different response. Use a variable to remember their choice for later in the story.',
        instructions: [],
        code: {
          blocks: `on chat command "yes"
  set trusted to true
  say "Great, follow me!"
on chat command "no"
  set trusted to false
  say "Very well... be careful out there."`,
          python: `trusted = False
def on_yes(command):
    global trusted
    trusted = True
    player.say("Great, follow me!")
def on_no(command):
    global trusted
    trusted = False
    player.say("Very well... be careful out there.")
player.on_chat("yes", on_yes)
player.on_chat("no", on_no)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt: "Change what happens when the player says yes/no — different messages, different trusted value.",
          },
          {
            tier: 2,
            prompt:
              'Add a third choice, "maybe". Booleans can\'t be \'a bit true\', so turn trusted into a text variable ("yes", "no", "unsure") and update all three chat commands to match.',
          },
          {
            tier: 3,
            prompt:
              'Challenge: use the trusted variable somewhere else in your world — e.g. write an on_chat("door") command that only opens (prints "Door opens!") if trusted is true, and refuses otherwise. Plan out: what do you check, and with which block?',
          },
        ],
      },
    },
  },
  {
    id: "pattern",
    icon: "🎨",
    title: "PATTERN",
    subtitle: "Pixel-Art Wall",
    when: "take-home",
    coreConcept: {
      name: "ARRAYS/LISTS + NESTED LOOPS",
      description:
        "Storing a whole pattern as a list of rows, then having code build it automatically.",
    },
    tracks: {
      beginner: {
        goal: "Make the Agent alternate between two block colours in a straight line using a repeat loop and an if/else on an alternating variable.",
        instructions: [],
        code: {
          blocks: `set useRed to true
repeat 10 times
  if useRed
    agent place: Red Wool
  else
    agent place: White Wool
  set useRed to (not useRed)
  agent move: forward, 1`,
          python: `use_red = True
for i in range(10):
    if use_red:
        agent.place(RED_WOOL)
    else:
        agent.place(WHITE_WOOL)
    use_red = not use_red
    agent.move(FORWARD, 1)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt: "Change Red/White to two different colours of your choice.",
          },
          {
            tier: 2,
            prompt:
              "Instead of alternating every block, alternate every TWO blocks (RRWWRRWW instead of RWRWRW) — think about what needs to change in your if/else logic.",
          },
          {
            tier: 3,
            prompt:
              "Challenge: using only a repeat loop and if/else (no lists yet!), make a 3-colour stripe pattern that repeats — e.g. Red, White, Blue, Red, White, Blue. Plan out how you'll track 'which colour am I on' with more than just true/false.",
          },
        ],
      },
      advanced: {
        goal: "Design a small picture (a flag, a face, a game character) on squared paper first. Store each row as a list, then loop through every row and every square to build it automatically.",
        instructions: [],
        code: {
          blocks: `set pattern to list:
  ["R","R","W","W"]
  ["W","R","R","W"]
for each row in pattern
  for each cell in row
    if cell == "R"
      agent place: Red Wool
    else
      agent place: White Wool
    agent move: forward, 1
  agent move: up, 1
  agent turn back`,
          python: `pattern = [
    ["R","R","W","W"],
    ["W","R","R","W"],
]
for row in pattern:
    for cell in row:
        if cell == "R":
            agent.place(RED_WOOL)
        else:
            agent.place(WHITE_WOOL)
        agent.move(FORWARD, 1)
    agent.move(UP, 1)`,
        },
        tryIts: [
          {
            tier: 1,
            prompt: "Change a few R/W values in the pattern list to redesign the picture.",
          },
          {
            tier: 2,
            prompt:
              "Make the pattern bigger — add a third row to the list, and make sure your loops still build it correctly without changing the loop code itself.",
          },
          {
            tier: 3,
            prompt:
              "Challenge: design your own small pixel-art picture on paper (a heart, a creeper face, your initials) using only R and W, turn it into a pattern list, and build it with the exact same nested-loop code — no code changes needed, only data. That's the real power of arrays + loops working together!",
          },
        ],
      },
    },
  },
];

export function getModule(id: string): ModuleContent | undefined {
  return MODULES.find((m) => m.id === id);
}
