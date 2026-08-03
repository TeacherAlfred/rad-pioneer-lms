# Skill 1: The Warning Light

## Welcome: The Digital Actuator @unplugged
Welcome Pioneer!<br>
Today we are using the **Yellow LED Module**.<br>
Unlike a sensor that reads the world, an ** *LED* ** changes the world by emitting light.<br>
This is a "Digital Output." We send a ** `1` ** to turn it on and a ** `0` ** to turn it off.

## Step 1: The Control Switches
Let's build manual switches.<br>
Click on the pink ``||input:Input||`` drawer and grab two ``||input:on button A pressed||`` blocks.<br>
On one of them, click on the small white triangle next to the *A* and change it to **B**. Your block will now say ``||input:on button B pressed||``

## Step 2: Sending the Signal
Go to the red ``||pins:Pins||`` drawer (you may need to click **'Advanced'** to see it).<br>
Grab two ``||pins:digital write pin P0 to 0||`` blocks. Put one inside each *on button A/B pressed* block. 

## Step 3: On and Off
Change the pins to **P1**. 
Change Button A's value to `1` (ON). 
Leave Button B's value at `0` (OFF).

```blocks
input.onButtonPressed(Button.A, function () {
    pins.digitalWritePin(DigitalPin.P1, 1)
})
input.onButtonPressed(Button.B, function () {
    pins.digitalWritePin(DigitalPin.P1, 0)
})
```

## [OPTIONAL] Test it with real hardware!

1. Plug your LED Module into **Pin 1** (P1).
2. Connect your USB and click **Download**.
3. Here is what should happen:<br>
Press Button A. The LED light should instantly switch on.<br>
Now, press Button B. The LED light should switch off.

## TASK: Add you own magic
Click the Done button in the next step to open the full Makecode interface.<br>
**Challenge:** Right now, the LED stays on until you manually turn it off.<br>
Can you grab an ``||input:on button A+B pressed||`` block, add a ``||loops:repeat||`` loop, and use ``||basic:pause||`` blocks to make the LED flash automatically like an emergency warning light?

## Submission: Upload your link on the RAD Academy task @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!