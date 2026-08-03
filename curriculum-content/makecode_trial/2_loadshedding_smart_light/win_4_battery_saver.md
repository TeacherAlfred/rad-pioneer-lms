
# Win 4: Energy Saver Mode

## Welcome @unplugged
Stage 6 loadshedding has hit, Pioneer! 
<br><br>
Your emergency lights are working beautifully, but there is a major problem: Neopixel lights use a *lot* of power. If they blast bright white all night while you are sleeping, your backup battery will be dead by morning! 
<br><br>
We need to upgrade our smart home to be **Energy Efficient**. We will add a Motion Sensor so the lights only go to maximum brightness when someone is actually moving in the room.

## CONCEPT: Digital Sensors vs Analog Sensors @unplugged
To do this, we are connecting a **PIR Motion Sensor** to **Pin 1**. But this sensor speaks a different language than our Light Level sensor!
<br>
* Our Light sensor is **ANALOG**: It gives us a range of numbers (0 to 255) so we can measure *exactly* how dark it is.
* Our Motion sensor is **DIGITAL**: It only has two states. It sends a **1 (HIGH)** if it sees movement, and a **0 (LOW)** if the room is perfectly still. 

## CONCEPT: Nested Logic (A Rule Inside a Rule) @unplugged
How do we add this to our brain? We use a **Nested Conditional**.
<br><br>
Think of it like opening Nested dolls (Doll inside another doll). 
* **Outside Box:** *Is the power out AND is it dark?* * If YES, we open the box. Inside, we ask a second question: 
* **Inside Box:** *Is there movement?*
<br><br>
**IF** there is movement, we go Bright White. If there is NO movement, we drop to a dim Blue to save power!

## Step 0: System Restore
New objective, clean workbench! Because you are entering a new secure workspace, your previous code has been cleared.
<br><br>
Let's quickly re-assemble our Backup Generator engine from Win 3.
<br><br>
**Click the blue lightbulb icon below** to see the blueprint. Rebuild these blocks to restore your system, then click **Next** to upgrade it!

```blocks
let strip: neopixel.Strip = null
let Grid_Power = false

strip = neopixel.create(DigitalPin.P2, 24, NeoPixelMode.RGB)

input.onButtonPressed(Button.A, function () {
    Grid_Power = false
})

input.onButtonPressed(Button.B, function () {
    Grid_Power = true
})

basic.forever(function () {
    if (Grid_Power == false && input.lightLevel() < 50) {
        strip.showColor(neopixel.colors(NeoPixelColors.White))
    } else {
        strip.clear()
    }
})
```

## Step 1: The Inner Rule (Nested IF)
Let's build the "Inside Box". 
<br>
1. Go to the teal ``||logic:Logic||`` drawer and grab a new ``||logic:if / else||`` block. 
2. Snap this new block *directly inside* the top section of your old `if` block (right above where your `||neopixel:show color white||` block currently is). 
<br><br>
You have just created a **Nested Statement**! The computer will only read this new block *if* the first rule (Power out & Dark) is already true.

```blocks
let strip: neopixel.Strip = null
basic.forever(function () {
    if (Grid_Power == false && input.lightLevel() < 50) {
        if (true) {
        	
        } else {
        	
        }
        strip.showColor(neopixel.colors(NeoPixelColors.White))
    } else {
        strip.clear()
    }
})
```

## Step 2: Reading Digital Pin 1
Now, let's ask the motion sensor if it sees anything.
<br>
1. From the ``||logic:Logic||`` drawer, grab a ``||logic:0 = 0||`` block and drop it into the `true` space of your *new* `if` block.
2. Go to the red ``||pins:Pins||`` drawer (under Advanced) and grab ``||pins:digital read pin P0||``. 
3. Drop it into the first **0**. Change **P0** to **P1**!
4. Change the second **0** to **1**. 

*Your rule now asks: Does Pin 1 see movement (1)?*

```blocks
let strip: neopixel.Strip = null
basic.forever(function () {
    if (Grid_Power == false && input.lightLevel() < 50) {
        if (pins.digitalReadPin(DigitalPin.P1) == 1) {
            
        } else {
            
        }
    } else {
        strip.clear()
    }
})
```

## Step 3: Setting the Energy States

Time to manage the power output!
1. Move your `||neopixel:strip show color white||` block into the top part of your _nested_ `if` block (so it blasts white when movement = 1).
2. Grab another `||neopixel:strip show color||` block and put it in the nested `else` block.
3. Change the color to **Blue** (This is our low-power standby mode!).

```blocks
let strip: neopixel.Strip = null
basic.forever(function () {
    if (Grid_Power == false && input.lightLevel() < 50) {
        if (pins.digitalReadPin(DigitalPin.P1) == 1) {
            strip.showColor(neopixel.colors(NeoPixelColors.White))
        } else {
            strip.showColor(neopixel.colors(NeoPixelColors.Blue))
        }
    } else {
        strip.clear()
    }
})
```

## TASK: The Ultimate Simulation @unplugged

Look at your MakeCode simulator. Because you added a `digital read pin P1` block, the simulator has magically created a clickable **1 / 0** button on Pin 1 for you to test with!
1. Press **Button A** to kill the grid power.
2. Drop the **Light Level** to 0. The lights should turn Blue (Standby Mode).
3. Click the **P1** button so it changes to **1** (Motion Detected!). The lights should instantly blast White!
4. Click **P1** back to **0** (You went to sleep). The lights drop back to Blue.
5. Press **Button B** (The sun comes up / Power returns). The lights should completely turn off!

## SUBMISSION: Mission Accomplished! @unplugged

Outstanding engineering, Pioneer! You have built a highly complex, context-aware smart home system that monitors multiple sensors, manages its own battery life, and tracks external data states.

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!

```package
neopixel=github:microsoft/pxt-neopixel
```
