
# Win 3: The Backup Generator

## Welcome @unplugged
The pieces are coming together, Pioneer! 
<br><br>
You have a sensor that knows when it is dark (Win 1), and a variable that remembers if the grid power is out (Win 2). But right now, they are disconnected. 
<br><br>
If we turn on the emergency lights *just* because it is dark, we will waste battery power every single night! We need the micro:bit to check **both** conditions at the exact same time before it acts.

## CONCEPT: Compound Conditionals (The AND Gate) @unplugged
In computer science, when we want the computer to check multiple rules before doing something, we use **Compound Conditionals**.
<br><br>
We will use the **AND** block. Think of the **AND** block like a strict security guard. 
* Rule 1: Is the power off? 
* Rule 2: Is it dark? 
<br><br>
If Rule 1 is True, but Rule 2 is False (it's daytime), the guard says **NO**. The lights stay off. 
<br>
The guard will *only* say **YES** and turn on the lights if **BOTH** rules are true at the exact same time!

## Step 1: Initializing the Emergency Lights
First, we need to connect our heavy-duty Neopixel lights to the system.
<br>
1. Go to the `||neopixel:Neopixel||` drawer (you may need to click 'Extensions' to add it). <br>
2. Drag the `||neopixel:set strip to Neopixel at pin P2 with 24 leds||` block into your `||basic:on start||` block. *(Note: We will use Pin 2 for the lights!)*

```blocks
let strip = neopixel.create(DigitalPin.P2, 24, NeoPixelMode.RGB)
```

## Step 2: The AND Block

Let's upgrade the brain of your system!

1. Find your `||basic:forever||` land add an `||logic:if||` statement.
2. Open the teal `||logic:Logic||` drawer and find the `||logic:< > and < >||` block.
3. Snap the `||logic:and||` block into the empty space in your `||logic:if||` statement.

```blocks
basic.forever(function () {
    let Grid_Power = false
    if (input.lightLevel() < 50 && Grid_Power == false) {
    	
    }
})
```

## Step 3: Combining the Logic

Now we snap our two rules into the security guard!

  

1. From `||logic:Logic||` grab an `||logic:and||` block and put it into your `||logic:if||` statement.
2. Just like previously, add `||input:light level < 50||` block and snap it into the **right** side of the `||logic:and||` block.    
3. For the **left** side, go to `||logic:Logic||` and grab a `||logic:0 = 0||` block.   
4. Change the first `0` to a `||variables:Grid_Power||` variable, and the second `0` to `||logic:false||`.

```blocks
basic.forever(function () {
    if (Grid_Power == false && input.lightLevel() < 50) {
        
    } else {
        
    }
})
```

## Step 4: Let There Be Light!

When the conditions are met, we need to blast the emergency lights.
1. From the `||neopixel:Neopixel||` drawer, drag the `||neopixel:strip show color red||` block into the top part of your `||logic:if||` statement. Change the color to **White**.
2. We also need to turn them off when power returns! Drag a `||neopixel:strip clear||` block into the `||logic:else||` section.


```blocks
basic.forever(function () {
    if (Grid_Power == false && input.lightLevel() < 50) {
        strip.showColor(neopixel.colors(NeoPixelColors.White))
    } else {
        strip.clear()
    }
})
```

## TASK: Simulator Testing! @unplugged

This is the ultimate test of your logic engine. Look at the simulator:
1. Drag the light slider down to 0. Do the lights turn on? _(They shouldn't! Because Grid_Power is currently True by default)._
2. Press **Button A** to simulate a power outage.
3. Now, drag the light slider down. The emergency Neopixels should blast bright white!
4. Press **Button B** (power restored). The lights should immediately shut off to save battery.

## SUBMISSION: Win 3 Complete! @unplugged

You have successfully built a state-tracking engine! Your micro:bit now remembers if the city has power.

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!


```package
neopixel=github:microsoft/pxt-neopixel
```
