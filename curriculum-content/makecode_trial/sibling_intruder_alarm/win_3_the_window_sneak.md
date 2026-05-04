# Win 3: The Window Sneak

## Welcome Back @unplugged
Welcome back, Pioneer! Our door alarm is working perfectly. 
<br><br>
But what if the intruder realizes the door is trapped and climbs through the **window**? The door will not shake! We need a new type of sensor to secure the perimeter.

## Step 1: System Reboot (Refresher)
First, let's put our system back online. Rebuild the code from Win 1 and Win 2!
<br>
1. Set up your **Alarm_Is_On** variable.
2. Make Button B set it to **true** and Button A set it to **false**.
3. Put your IF statement inside the Shake block.
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
```

## SENSOR: MOTION (PIR) @unplugged

To trap the window, we will use a **Motion Sensor** (also called a PIR sensor).

A Motion Sensor doesn't have eyes. It cannot see shapes or colors.
<br>
Instead, it 'senses' the **body heat** of a person (or animal) moving nearby!

We will connect this sensor to **Pin 1** on the micro:bit.

## Step 2: The Forever Brain

We need the computer to _always_ be checking the window, not just when it shakes.
<br>
You already should have a `||basic:forever||` loop in your workspace.
If not, go to the blue `||basic:Basic||` drawer and grab a `||basic:forever||` loop.

Drop it into your workspace.

## CONCEPT: FOREVER LOOP @unplugged
Sometimes you want your code to do something **ALL THE TIME**. We can do that by using a *loop* called **forever**.
<br>
Anything you put inside this loop will be done *over and over and over* until your code stops running.

## Step 3: Check Pin 1

Inside your forever loop, add an `||logic:if true then||` block.

Now we need to check the sensor. Go to Logic, grab the `||logic:0 = 0||` block, and drop it over the word **true**.

Go to the red `||pins:Pins||` drawer (you might need to click **Advanced**), grab `||pins:digital read pin P0||`, and put it in the first `0`. Change **P0** to **P1**. Change the second `0` to a `1`.

_(This means: IF the sensor on Pin 1 feels body heat...)_

```block
basic.forever(function () {
    if (pins.digitalReadPin(DigitalPin.P1) == 1) {
        
    }
})
```

## Step 4: The Double Check (Nested Logic)

Wait! We ONLY want the alarm to go off if the system is actually armed. We need to check our switch!

  

Add _another_ `||logic:if true then||` block **inside** your first one.

  

Replace the word **true** with your `||variables:Alarm_Is_On||` variable. Finally, put your Angry Face inside!


```block
let Alarm_Is_On = false
basic.forever(function () {
    if (pins.digitalReadPin(DigitalPin.P1) == 1) {
        if (Alarm_Is_On) {
            basic.showIcon(IconNames.Angry)
        }
    }
})
```

## Step 5: Test the Motion Sensor!

Let's test our new window trap on the simulator!

  

Because we added code for Pin 1, a little **P1** button appeared on the virtual micro:bit. Clicking that button simulates someone walking by!

  

1. Click **P1**. (Nothing happens! You are safe.)
    
2. Click **Button B** to arm the system.
    
3. Click **P1** again. (Angry face! Intruder caught at the window!)
    
4. Click **Button A** to disarm it.
    

## TASK: Add your own magic

Double security, Pioneer! Your room is basically a fortress now.

Click the **Done** button in the next step to open the full Makecode interface.

  

Can you add a loud Siren sound from the `||music:Music||` drawer that plays when the Angry Face shows up?

## Step 6: Win 3 Complete! @unplugged
  
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!