# Skill 1: The Motion Detector

## Welcome @unplugged
Welcome Pioneer!<br>
We will now learn about using the **PIR Motion Sensor**. 

## Step 1: The Motion Sensor
This sensor detects moving infrared heat (*like a person or a pet walking by*). It is a *"Digital" sensor*, this means it only sends two messages: `1` for YES (motion), or it sends `0` for NO (no movement).

## Step 2: The Trigger
Let's ask the Brain to check for motion. 
From the pink ``||input:Input||`` drawer, grab an ``||input:on button A pressed||`` block and place it in your workspace.

```blocks
input.onButtonPressed(Button.A, function () {
})
```

## Step 3: Reading the Room
From the ``||basics:basics||`` drawer, grab a ``||basic:show number||`` block and place it inside your ``||input:on button A pressed||`` block. 

```blocks
input.onButtonPressed(Button.A, function () {
    basic.showNumber(0)
})
```

## Step 4: 
Then, go to the red ``||pins:Pins||`` drawer (click '**Advanced**' to see it) and grab the ``||pins:digital read pin P0||`` block. Drop it on the *0* in your show number block.<br>
Now, when you press A, it will show whatever the sensor is feeling (1 or 0)!

```blocks
input.onButtonPressed(Button.A, function () {
    basic.showNumber(pins.digitalReadPin(DigitalPin.P0))
})
```

## [OPTIONAL] Test it with real hardware!

1. Plug your **PIR Motion Sensor** into **Pin 0** (P0).<br>
2. Connect your USB and click **Download**.<br>
3. **Here is what should happen:**
   * Sit perfectly still and press *Button A*. The Micro:Bit should show a **0** (No motion).
   * Now, wave your hand in front of the white dome on the sensor and press *Button A* again. It should show a **1** (Motion detected)!
    
## TASK: Add your own magic

Showing a 1 or a 0 is great for testing, but let's make it fun! 
Click the **Done** button in the next step to open the full Makecode interface, then try adding your own flair. 

**Challenge:** Instead of just showing a number, can you make the Micro:Bit show a happy face if it detects motion, and an angry face if it doesn't? *(Hint: You might need an `if/else` block!)*
<br>

## Step 6: Win 1 Complete! @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!