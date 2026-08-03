# Win 1: The Darkness Detector

## Welcome @unplugged
Welcome to Mission 2, Pioneer! 
<br><br>
The city power grid just dropped, and your bedroom has gone completely dark! Don't panic. Before we turn on the emergency backup lights, our Brain (the *micro:bit*) needs to know if the room is actually dark.
<br><br>
We will use the built-in **Light Level** sensor to automatically detect the brightness of the room.

## CONCEPT: Light Level @unplugged
The micro:bit uses its LED screen to measure light! It gives us a number from **0 (Pitch Black)** to **255 (Blindingly Bright)**.
<br><br>
We will use an **IF / ELSE** logic block. *IF* the light level is low (less than 50), we know it is dark! *ELSE*, the sun is still up.

## Step 1: The Logic Brain
Let's give our system a brain that checks the light constantly.
<br>
From the blue ``||basic:Basic||`` drawer, drag out a ``||basic:forever||`` loop.
<br>
Then, from the teal ``||logic:Logic||`` drawer, drag an ``||logic:if / else||`` block and drop it inside.

```blocks
basic.forever(function () {
    if (true) {
        
    } else {
        
    }
})

```

## Step 2: The Darkness Math

Now we need to check if the light is less than 50.

1. Go back to `||logic:Logic||` and grab the `||logic:0 < 0||` comparison block. Drop it where it says **true**.
2. Go to the pink `||input:Input||` drawer and grab the `||input:light level||` block. Drop it in the first **0**.
3. Change the second **0** to **50**.

```blocks
basic.forever(function () {
    if (input.lightLevel() < 50) {
        
    } else {
        
    }
})

```

## Step 3: Sun and Moon Icons

Let's show a Moon if it is dark, and a Sun if it is bright!

From the `||basic:Basic||` drawer, grab two `||basic:show icon||` blocks.

* Put one inside the top of the **IF** statement and change it to the Moon (or Asleep) icon.
* Put the other inside the **ELSE** section and change it to the Sun (or Target) icon.

```blocks
basic.forever(function () {
    if (input.lightLevel() < 50) {
        basic.showIcon(IconNames.Asleep)
    } else {
        basic.showIcon(IconNames.Target)
    }
})

```

## TASK: Simulator Testing! @unplugged

Look at the MakeCode simulator on your screen. You will see a new **sun slider** appear in the top left corner!

Use your mouse to drag the sun slider up and down. Watch how your micro:bit automatically changes from a Sun to a Moon when the light drops below 50!


## SUBMISSION: Win 1 Complete! @unplugged

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!