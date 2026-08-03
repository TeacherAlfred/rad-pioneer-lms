# Skill 1: The Smart Fan

## Welcome: The Actuator @unplugged
Welcome Pioneer! <br>
You have moved from **Inputs** (sensing the world) to **Outputs** (changing the world). 
Today we are using the **130 Motor Module**. This is an analog output, meaning we can send it different power levels to control its speed!

## Step 1: The Controls
Let's build a manual control system. 
Click on the pink ``||input:Input||`` drawer and grab two ``||input:on button A pressed||`` blocks and change one to ``||input:on button B pressed||``.

## Step 2: Pushing Power
Go to the red ``||pins:Pins||`` drawer (you may need to click **'Advanced'** to see it).<br>
Take two ``||pins:analog write pin P0 to 1023||`` blocks. Put one inside each *on button A/B pressed* block. 

## Step 3: Setting the Speed
Change the pins to **P1** on both *on button A/B pressed* blocks.<br>
- Button A will be our "**ON**" button, so leave its power at `1023` (maximum speed!). 
- Button B will be our "**OFF**" button, so change its power to `0` (zero power).

```blocks
input.onButtonPressed(Button.A, function () {
    pins.analogWritePin(AnalogPin.P1, 1023)
})
input.onButtonPressed(Button.B, function () {
    pins.analogWritePin(AnalogPin.P1, 0)
})
```

## [OPTIONAL] Test it with real hardware!

1. Plug your motor into **Pin 1** (P1).
2. Connect your USB and click **Download**.
3. Here is what should happen:<br>
Press Button A. The motor should instantly switch on and spin at maximum speed.<br>
Now, press Button B. The motor should stop spinning.

## TASK: Add you own magic
Click the Done button in the next step to open the full Makecode interface.<br>
**Challenge:** Right now, the fan is either blowing at maximum speed (1023) or is completely off (0).<br>
Can you grab an ``||input:on button A+B pressed||`` block and make the fan spin at half speed? (Hint: What is half of 1023? Try typing in 511!)

## Submission: Upload your link on the RAD Academy task @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!