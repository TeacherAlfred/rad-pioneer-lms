# Skill 1: The Steam & Water Sensor

## Step 1: The Water Detector
Welcome Pioneer! Today we are reading data from the **Steam / Water Sensor**. 
This sensor acts as an analog ** *input* **. The more water that touches its lines, the higher the electrical signal it sends back to the Brain!

## Step 2: The Trigger
Let's take a single reading. Grab an ``||input:on button A pressed||`` block from the pink ``||input:Input||`` drawer and put it in your workspace.

## Step 3: Reading the Sensor
From the blue ``||basic:Basic||`` drawer, grab a ``||basic:show number||`` block and place it inside your button block. 

## Step 3: Reading the Sensor [2]
Go to the red ``||pins:Pins||`` drawer (you may need to click **'Advanced'** to see it) and grab the ``||pins:analog read pin P0||`` block. 
<br>
Drop it into your ``||basic:show number||`` block to replace the **0**.

```blocks
input.onButtonPressed(Button.A, function () {
    basic.showNumber(pins.analogReadPin(AnalogPin.P0))
})
```

## [OPTIONAL] Step 5: If you have a Microbit, flash to the Brain!

1. Plug your Steam Sensor into **Pin 0** (P0).<br>
2. Connect your USB and click **Download**.<br>
3. Press Button A to read the exact moisture level of the room. Touch the sensor with a damp finger and press A again to see the number go up!
    
## TASK: Add your own magic

Click the **Done** button in the next step to open the full Makecode interface, then try adding your own flair!
<br>

## Step 6: Win 1 Complete! @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!