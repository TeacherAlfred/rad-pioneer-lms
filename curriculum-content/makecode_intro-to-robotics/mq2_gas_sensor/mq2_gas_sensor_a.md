# Skill 1: The Smoke Detector

## Welcome @unplugged
Welcome Pioneer!<br> Today we are using the **MQ2 Gas & Smoke Sensor**. <br>
This sensor acts as an *analog* input. It constantly "smells" the air. The more smoke or gas it detects, the higher the electrical signal it sends back to the Brain (The *Micro:bit*)!

## Step 1: The Trigger
Let's take a single reading to see how clean the air is.<br>
From the pink ``||input:Input||`` drawer, grab an ``||input:on button A pressed||`` block and place it in your workspace.

```blocks
input.onButtonPressed(Button.A, function () {

})
```

## Step 3: Reading the Air [1]
From the blue ``||basic:Basic||`` drawer, grab a ``||basic:show number||`` block and place it inside your  ``||input:on button A pressed||``  block. 

```blocks
input.onButtonPressed(Button.A, function () {
    basic.showNumber(0)
})
```

## Step 4: Reading the Air
Then, go to the red ``||pins:Pins||`` drawer (click '**Advanced**' to see it) and grab the ``||pins:digital read pin P0||`` block.<br>
Drop it on the *0* in your show number block, and change P0 to **P2**.

```blocks
input.onButtonPressed(Button.A, function () {
    basic.showNumber(pins.analogReadPin(AnalogPin.P2))
})
```

## [OPTIONAL] Test it with real hardware!

1. Plug your Gas Sensor into **Pin 2** (P2).
2. Connect your USB and click **Download**.
3. Here is what should happen:<br>
Press Button A to read the room's normal air quality. (Usually, clean air reads between 50 and 150).<br>
Now, breathe heavily onto the metal mesh of the sensor (or hold a non-lit, slightly smelly marker near it) and press Button A again. You should see the number spike up!

## Submission: Upload your link on the RAD Academy task @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!