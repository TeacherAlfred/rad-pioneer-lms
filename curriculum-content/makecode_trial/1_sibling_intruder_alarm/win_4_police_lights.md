# Win 4: Police Lights

## Welcome Back @unplugged
Welcome back, Pioneer! The alarm works, but it isn't very intimidating.
<br><br>
Let's add some visual flair by integrating **Neopixel** LED lights that flash like police lights when the alarm is triggered!

## Step 1: System Reboot (Refresher)
First, let's put our system back online. Rebuild the code from your previous wins!
<br>
1. Set up your **Alarm_Is_On** variable.
2. Make Button B set it to **true** and Button A set it to **false**.
3. Put your IF statements inside the Shake block and the Forever loop (checking Pin 1).
```blocks
let Alarm_Is_On = false
basic.showIcon(IconNames.Target)
input.onButtonPressed(Button.B, function () {
    Alarm_Is_On = true
})
input.onButtonPressed(Button.A, function () {
    Alarm_Is_On = false
    basic.clearScreen()
})
input.onGesture(Gesture.Shake, function () {
    if (Alarm_Is_On) {
        basic.showIcon(IconNames.Angry)
    }
})
basic.forever(function () {
    if (pins.digitalReadPin(DigitalPin.P1) == 1) {
        if (Alarm_Is_On) {
            basic.showIcon(IconNames.Angry)
        }
    }
})
```

## NEOPIXELS (Output) @unplugged

We are going to use **Neopixels**. These are special LED lights where we can control the exact color of every single light on the strip!
<br>
We need to tell the micro:bit two things:
1. Which pin the lights are connected to (We will use **Pin 0**).
2. How many lights are on the strip (Let's say **4**).

## Step 2: Initialize the Lights

Click on the `||neopixel:Neopixel||` drawer.

Grab the `||Neopixel:set strip to Neopixel at pin P0 with 24 leds||` block.

Drop it into your `||basic:on start||` block. Change the `24` to `4` to match our light strip.

```blocks
let strip = neopixel.create(DigitalPin.P0, 4, NeoPixelMode.RGB)
```

## Step 3: Red and Blue Flashes

Let's make the lights flash like police sirens when the alarm triggers!

We need to create a **function** to handle the flashing so we don't have to write the same code twice (once for the door shake, once for the window sensor).

Go to the `||functions:Functions||` drawer (under Advanced), click **Make a Function**, and change the name from *doSomething* to **``police_lights``**.

## CONCEPT: Functions @unplugged

A **FUNCTION** is....

## Step 4: Building the Siren

Inside your new `||functions:function police_lights||` block, let's make it flash.

1. Add `||neopixel:strip show color red||`.
2. Add a `||basic:pause 100||` (milliseconds). This is in the ``||basic:Basic||`` drawer
3. Add `||neopixel:strip show color blue||`.
4. Add another `||basic:pause 100||`.
```blocks
let strip = neopixel.create(DigitalPin.P0, 4, NeoPixelMode.RGB)
function police_lights () {
    strip.showColor(neopixel.colors(NeoPixelColors.Red))
    basic.pause(100)
    strip.showColor(neopixel.colors(NeoPixelColors.Blue))
    basic.pause(100)
}
```

## Step 5: Connect the Function

Now, instead of just showing the angry face, let's call our flashing lights!

Go back to the `||functions:Functions||` drawer and grab the `||functions:call police_lights||` block.
<br>
Place it inside BOTH of your IF statements (the shake sensor and the motion sensor), right after `||basic.showIcon(IconNames.Angry)||`.
```blocks
let Alarm_Is_On = false
let strip = neopixel.create(DigitalPin.P0, 4, NeoPixelMode.RGB)
function police_lights () {
    strip.showColor(neopixel.colors(NeoPixelColors.Red))
    basic.pause(100)
    strip.showColor(neopixel.colors(NeoPixelColors.Blue))
    basic.pause(100)
}
input.onGesture(Gesture.Shake, function () {
    if (Alarm_Is_On) {
        basic.showIcon(IconNames.Angry)
        police_lights()
    }
})
```

## Step 6: Turning the Lights Off!

If you test this, the lights will flash red and blue... and then stay blue forever! We need a way to turn them off.

Remember Button A? It disarms our system. Let's make it also turn the lights off.

Go to the `||neopixel:Neopixel||` drawer, grab `||neopixel:strip clear||`, and put it inside your `||input:on button A pressed||` block. Don't forget to add a `||neopixel:strip show||` right after it so the clear command updates the lights!

```blocks
let Alarm_Is_On = false
let strip = neopixel.create(DigitalPin.P0, 4, NeoPixelMode.RGB)
input.onButtonPressed(Button.A, function () {
    Alarm_Is_On = false
    strip.clear()
    strip.show()
})
```

## Step 7: Test the Siren!

Let's test our complete alarm system on the simulator!

1. Click **Button B** to arm the system.
2. Click **SHAKE** or **P1** to trigger the alarm.
3. Watch the Neopixel strip flash red and blue!
4. Click **Button A** to disarm the system and turn off the lights.

## TASK: Add your own magic

Incredible work, Pioneer! You've built a fully functional, multi-sensor alarm system with visual feedback.

Click the **Done** button to open the full interface.

Can you change the `police_lights` function to loop 5 times using a `||loops:repeat||` block? Or maybe change the colors to match your favorite superhero?

## Step 8: Final Uplink! @unplugged
  
This is the final win for this mission! When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!

```package
neopixel=github:microsoft/pxt-neopixel
```

<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>