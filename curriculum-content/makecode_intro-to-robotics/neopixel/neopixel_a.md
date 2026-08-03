# Skill 1: The Smart Lights

## Welcome: The RGB Strip @unplugged
Welcome Pioneer!<br>
Today we are using the **NeoPixel LED Module**.<br>
Unlike the basic Yellow LED that just turns on and off, NeoPixels are "Smart" LEDs. They have tiny microchips inside them that allow us to mix colors and create almost any color imaginable!

## Step 1: Booting up the Lights
Because these lights are smart, we have to tell the Brain exactly how many lights are attached and where they are plugged in.<br>
Open the ``||neopixel:Neopixel||`` drawer and drag the ``||neopixel:set strip to NeoPixel at pin P0 with 24 leds||`` block into your ``||basic:on start||`` block. 

Change **P0** to **P1**, and change **24** to **4** (since we only have 4 lights!).

```blocks
let strip = neopixel.create(DigitalPin.P1, 4, NeoPixelMode.RGB)
```

## Step 2: Turning them Red
Now, let's make the lights turn red.

Click on the pink ``||input:Input||`` drawer again and grab another ``||input:on button A pressed||`` block. Put the block in your workspace.<br>
Inside it, place the ``||neopixel:strip show color red||`` block from the Neopixel drawer.


```blocks
let strip = neopixel.create(DigitalPin.P1, 4, NeoPixelMode.RGB)
input.onButtonPressed(Button.A, function () {
    strip.showColor(neopixel.colors(NeoPixelColors.Red))
})
```

## Step 3: Turning them Off
Finally, let's make a way to turn the lights off.
Add an ``||input:on button B pressed||`` block. Inside it, put a ``||neopixel:strip clear||`` block, followed by a ``||neopixel:strip show||`` block to push the update to the lights.

```blocks
let strip = neopixel.create(DigitalPin.P1, 4, NeoPixelMode.RGB)
input.onButtonPressed(Button.B, function () {
    strip.clear()
    strip.show()
})
```

## [OPTIONAL] Step 4: Test it with real hardware!
1. Plug your **NeoPixel Module** into **Pin 1** (P1) on your expansion board.
2. Connect your USB and click **Download**.
3. **Here is what should happen:**
    - Press _Button A_. All 4 LEDs should instantly glow bright Red!
    - Now, press _Button B_. The lights should clear and turn off.

## TASK: Add your own magic
Click the **Done** button in the next step to open the full Makecode interface.
**Challenge:** Red is cool, but a rainbow is cooler! Can you grab an ``||input:on button A+B pressed||`` block, and use the ``||neopixel:strip show rainbow||`` block to make your 4 LEDs glow in full color?

## Step 5: Win 1 Complete! @unplugged
When you are ready _(After clicking the **done** button)_, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
Watch the video below if you need help with the steps.
Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!

```package
neopixel=github:microsoft/pxt-neopixel
```

<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
