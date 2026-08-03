# Skill 1: The Precision Motor

## Welcome: The Servo Brain @unplugged
Welcome Pioneer!<br>
Today we are using the **180 Degree Servo Motor**. <br>
Unlike a fan that spins forever, a Servo moves to an exact angle (*between 0° and 180°*).<br>
This is how robot arms and smart locks work!

## Step 1: The Manual Controls
Let's build a controller.<br>
From the pink ``||input:Input||`` drawer, grab an ``||input:on button A pressed||`` block and place it in your workspace.

## Step 2: Another Manual Control
Click on the pink ``||input:Input||`` drawer again and grab another ``||input:on button A pressed||`` block. Put the block in your workspace.<br>
Click on the small white triangle next to the *A* and change it to **B**. Your block will now say ``||input:on button B pressed||``

## Step 3: Setting the Angle
Go to the red ``||pins:Pins||`` drawer (you may need to click **'Advanced'** to see it).<br>
Put the ``||pins:servo write pin P0 to 180||`` block into each *on button A/B pressed*.

## Step 4: Open and Close
1. Click on both *P0* and change the pins to **P1**.
2. Change the number in Button A to **0** (This might be "Closed").
3. Change the number in Button B to **180** (This might be "Open").

```blocks
input.onButtonPressed(Button.A, function () {
    pins.servoWritePin(AnalogPin.P1, 0)
})
input.onButtonPressed(Button.B, function () {
    pins.servoWritePin(AnalogPin.P1, 180)
})
```

## [OPTIONAL] Test it with real hardware!

1. Plug your Servo into **Pin 1** (P1).
2. Connect your USB and click **Download**.
3. Here is what should happen:<br>
Press Button A. The white plastic arm (the horn) on the servo should instantly spin to the 0-degree position.<br>
Now, press Button B. The arm should sweep all the way across to the 180-degree position!

## TASK: Add you own magic
Click the Done button in the next step to open the full Makecode interface.<br>
**Challenge:** Right now the servo only opens and closes fully.
Can you grab an ``||input:on button A+B pressed||`` block and make the servo move exactly to the middle (*90 degrees*)?

## Submission: Upload your link on the RAD Academy task @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!