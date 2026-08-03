# Win 1: The Door Shake

## Welcome @unplugged
Welcome to HQ, Pioneer! Let's build your Intruder Alarm. 
<br>
Imagine creating your own **personal alarm** for intruders (*siblings*) entering your bedroom without permission.
<br><br>
That's exactly what we are going to learn to do.

## Step 1: The Pulse
First, we need to confirm the system is awake when we turn it on. 
<br>
We will show a **shield** icon.

## Step 2: Show a Shield
Let's show a shield icon when the system boots up. 
From the **Toolbox** grab a ``||basic:show icon||`` block, drag it and snap it inside the ``||basic:on start||`` block. 
<br>
Click on the *heart* and select any icon that will represent your *shield*.
```blocks
basic.showIcon(IconNames.Target)
```

## SENSOR: ACCELEROMETER (Input) @unplugged

The micro:bit has a tiny **Movement Sensor** inside it. It can feel when a door swings open!
<br>
We will use it to tell us when your door is opened.
<br><br>
*The sensor is called an **ACCELEROMETER** *.

## Step 4: The Shake Alarm

Click on the pink ``||input:Input||`` drawer and grab the ``||input:on shake||`` block and pull it into your workspace.

Inside it, put another ``||basic:show icon||`` block, but this time pick an **Angry Face**!

```blocks
input.onGesture(Gesture.Shake, function () {
    basic.showIcon(IconNames.Angry)
})
```

## Step 5: Test the Shake!

Look at the virtual micro:bit on the left. Click the white **SHAKE** button that appeared. Did the angry face show up?


## CONCEPT: CONDITION @unplugged
What you coded is called a **CONDITION**.
<br>
A *condition* is like a special rule or a promise.<br>
It tells the computer (Or a person): "Wait until this exact thing happens before you do the other thing!"
<br><br>
You can think of it as an **IF / THEN** rule:
* **Real Life:** **IF** it is raining outside, **THEN** take an umbrella!
* **Real Life:** **IF** you finish your homework, **THEN** you can play a game!
* **Our Code:** **IF** the micro:bit shakes, **THEN** show the angry face!

## TASK: Add your own magic
Great job! You caught the door moving. 

Click the **Done** button in the next step to open the full Makecode interface, then try adding your own flair!
<br>
Can you make it play a loud alarm sound using the Music blocks when it shakes?
<br>

## Step 6: Win 1 Complete! @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!