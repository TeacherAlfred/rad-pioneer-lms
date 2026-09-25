import type { LabContent } from './types';

const lab: LabContent = {
  slug: 'makecode-01',
  seriesKey: 'makecode',
  labNumber: 1,
  title: 'Code Your First Program Tonight',
  subtitle: 'No kit needed. Free to use right now. Your child builds a real, working program in 20 minutes — and learns what their school forgot to name.',
  seo: {
    description: 'A free 20-minute MakeCode lab for ages 8–14. No hardware, no downloads — your child builds a real, working program tonight.',
  },
  chips: [
    { icon: '⏱', label: '20 min', info: 'The hands-on part is 7 short steps, sized to take about 20 minutes including time to experiment. The reading for parents around it is extra and can be done any time.' },
    { icon: '👤', label: 'Ages 8–14', info: 'The blocks are drag-and-drop, so there\'s no typing and no maths beyond counting. An 8-year-old who can read short instructions can follow along, and teens who have never coded still find it useful.' },
    { icon: '💻', label: 'MakeCode', platform: true, info: 'Microsoft\'s free coding editor for the Micro:Bit. It runs in any web browser — nothing to install and no account needed.' },
    { icon: '🔧', label: 'No hardware needed', info: 'MakeCode has a built-in simulator: a virtual Micro:Bit on screen that runs your code. This lab works entirely in the browser; real hardware only comes in later labs.' },
  ],
  hook: 'Your child has already seen this — lights that respond to a button, characters that react on screen, scores that change when something happens. **They understand the logic.** This lab gives it a name and puts the controls in their hands, tonight, for free.',
  context: {
    heading: 'What is MakeCode?',
    body: 'MakeCode is a free, browser-based coding environment built by Microsoft. It uses visual blocks — the same approach as Scratch — but everything your child builds here translates directly to physical hardware like the Micro:Bit. No downloads. No account needed. Open the link and start.',
    screenshot: { alt: 'MakeCode editor at rest — block menu on left, Micro:Bit simulator on right, empty workspace in centre', ratio: '16/9' },
  },
  steps: [
    {
      title: 'Open the editor',
      body: 'Go to [makecode.microbit.org](https://makecode.microbit.org) in any browser — Chrome, Safari, Firefox, all work. You\'ll see a blue welcome screen. Click _New Project_ and type any name in the box that appears — your name works perfectly. Hit _Create_.',
      screenshot: { alt: 'New project dialog open, name field highlighted with cursor ready to type' },
      callout: '**Already signed in to Microsoft?** Your project saves automatically to the cloud. If not, it saves to your browser — either way, you won\'t lose your work.',
    },
    {
      title: 'Meet the workspace',
      body: 'Your workspace has three parts. On the **left**: a Micro:Bit simulator that runs your code live — no physical device needed. In the **middle**: the block menu, sorted into categories like Basic, Input, and Logic. On the **right**: the canvas where you\'ll drag and drop blocks to build your program.',
      screenshot: { alt: 'Three-panel layout annotated: simulator left, block menu middle, canvas right' },
      callout: 'Two blocks are already on your canvas: **on start** and **forever**. The _forever_ block is a ==loop==: it keeps running your code over and over, as fast as it can. That\'s the heartbeat of almost every app ever written.',
    },
    {
      title: 'Explore the Basic menu',
      body: 'Click **Basic** in the middle menu. A list of blocks slides out. You\'ll see blocks like _show number_, _show string_, _show LEDs_, and _pause_. Hover over any of them — a tooltip explains what each one does. Don\'t click anything yet, just explore.',
      screenshot: { alt: 'Basic menu open, show string block highlighted, tooltip visible' },
      callout: '**Notice the colours.** Each category has its own colour. When your program gets complex, colour coding helps you read it at a glance.',
    },
    {
      title: 'Make it display your name',
      body: 'Drag the **show string** block from the Basic menu and drop it inside the _forever_ loop already on your canvas. Click the white text box inside the block and type your name — or anything you like. Watch the simulator on the left: your name starts scrolling across the LED display immediately.',
      screenshot: { alt: 'show string block snapped inside forever loop, name typed in, simulator scrolling the name on the LED grid' },
    },
    {
      title: 'Try changing things',
      body: 'Click the text inside the block and change it. Try your favourite game, your pet\'s name, or the word _HELLO_. Every change updates the simulator instantly — no Save button, no compile step. This instant feedback is deliberate. It\'s how MakeCode makes programming feel alive.',
      screenshot: { alt: 'show string block with new text, simulator updating live with a different message' },
      callout: '**Bonus experiment:** Drag a _pause (ms)_ block from Basic and drop it below show string, still inside forever. Set it to 1000 ms. What changes? What stays the same?',
    },
    {
      title: 'React to a button press',
      body: 'Click **Input** in the block menu. Drag **on button A pressed** onto the canvas — place it outside the forever loop, anywhere with blank space. Now drag the _show string_ block out of forever and drop it inside _on button A pressed_. Leave the forever loop empty for now. Click the **A** button in the simulator.',
      screenshot: { alt: 'on button A pressed block containing show string; cursor on the simulator\'s A button; name visible on the LED grid' },
      callout: '**Notice what changed:** Before, your name scrolled constantly. Now, nothing happens until you press A. You\'ve just added one of the most important ideas in computing — the ==event==.',
    },
    {
      title: 'See the pattern',
      body: 'Look at what you\'ve built. An ==event== (button press) triggers an ==action== (show string) only when a ==condition== is true (A was pressed). This pattern — _if input → then output_ — is the foundation of every interactive system that exists. The lock on your front door. The send button in WhatsApp. The traffic light at the end of your road.',
      screenshot: { alt: 'Final program: on button A pressed with show string inside, empty forever block alongside', ratio: '4/3' },
      callout: '**Challenge before you move on:** Try adding _on button B pressed_ with a different message. Can you make A show your name and B show your school? Two events. Two outputs. Same pattern.',
    },
  ],
  aha: {
    heading: 'You\'ve been using this your whole life.',
    intro: 'The code you just wrote — _if button pressed, then show name_ — runs the world around you. Here\'s where you\'ve already seen it, without knowing what to call it.',
    cards: [
      { kind: 'unplugged', concept: 'Condition', title: 'Making tea', body: 'You don\'t add the teabag until the water boils. That\'s a condition: _IF water is boiling THEN add tea, ELSE wait._ Same structure you just coded.', image: { alt: 'Kettle, teabag and mug' } },
      { kind: 'unplugged', concept: 'If / else', title: 'The tuckshop', body: '_IF I have R10 or more THEN buy the pie, ELSE buy the chips._ Every purchase decision you make is a true-or-false check. Your button press was your R10.', image: { alt: 'School tuckshop counter with coins' } },
      { kind: 'unplugged', concept: 'Loop + event', title: 'Traffic lights', body: 'A traffic light loops through red, green and orange forever, on a timer. When a pedestrian presses the button, that\'s an event. Exactly what you built.', image: { alt: 'Pedestrian crossing traffic light showing red' } },
      { kind: 'tech', concept: 'AND condition', title: 'Unlocking your phone', body: 'Your phone keeps checking: _IF a finger touches AND the fingerprint matches THEN unlock._ Two conditions chained together — the pattern you just learned.', image: { alt: 'Phone screen with fingerprint unlock prompt' } },
      { kind: 'tech', concept: 'Loop', title: 'YouTube autoplay', body: '_Keep playing the next video_ — until you press pause. That\'s a loop with an event listener waiting for your input. Sound familiar?', image: { alt: 'YouTube autoplay countdown to the next video' } },
      { kind: 'tech', concept: 'Event', title: 'Sending a WhatsApp', body: 'Nothing sends until you press the button. _IF send pressed THEN transmit message._ The app waits for the trigger — exactly what your A button did.', image: { alt: 'Hand pressing send in a WhatsApp chat' } },
    ],
  },
  reveal: {
    eyebrow: 'What your child just built',
    concept: 'Boolean Logic',
    body: 'The pattern they used — _if button pressed, then show name_ — has a formal name. It\'s a ==Boolean condition==: a test that is either true or false, with an action attached to the outcome. This isn\'t a beginner concept. It\'s the foundation of every app, every website, and every automated system on the planet.',
    quote: 'The logic that turns on a car\'s headlights at dusk. The check that approves a bank transfer. The rule that changes a traffic light. Every one is an if-then statement — exactly what your child just wrote.',
  },
  fork: {
    nextLabTeaser: 'Lab 02 drops next week. Leave your WhatsApp number and we\'ll send it to you when it\'s ready — just the next lab, no spam.',
    waitlistTitle: 'See this on real hardware',
    waitlistBody: 'When a workshop opens in your area, you\'ll hear first — before it goes public. Your child builds this with a physical Micro:Bit, in a room full of kids doing the same.',
    workshopProgramCode: 'MCE-101',
  },
  faqs: [
    {
      q: 'The simulator stops scrolling and freezes. What\'s wrong?',
      a: 'Nothing is wrong — the simulator usually pauses itself when you click outside it or switch browser tabs. Click directly on the Micro:Bit image in the simulator and it restarts. If it still looks stuck, refresh the page — your blocks are saved in the browser.',
    },
    {
      q: 'My child finished this. What should they try next?',
      a: '**Right now:** add a second event — _on button B pressed_ showing a different message. Then try putting both messages inside one forever loop with a pause between them, and see what happens when an event and a loop run at the same time. **Next week:** Lab 02 connects this logic to a pattern of LEDs your child designs themselves.',
    },
    {
      q: 'What exactly is Boolean logic and why does it matter?',
      a: '==Boolean logic== is reasoning with only two values: true and false. Every decision a computer makes reduces to one of those — is the button pressed or not, is the balance high enough or not, does the fingerprint match or not. It\'s named after mathematician George Boole (1815–1864), and it predates computers by a century.',
    },
  ],
};

export default lab;
