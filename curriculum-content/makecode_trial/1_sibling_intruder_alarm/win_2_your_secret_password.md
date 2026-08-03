# Win 2: Your Secret Password

## Welcome Back @unplugged
Welcome back, Pioneer! We have a major problem with our base security. 
<br><br>
If *you* open the door to your room, the alarm will ring on YOU! We need a secret way to disarm the system so you can enter safely.

## Step 1: System Reboot (Refresher)
First, let's put our system back online. Rebuild the code from Win 1!
<br>
1. Put a ``||basic:show icon||`` (Shield/Target) inside ``||basic:on start||``.
2. Put a ``||basic:show icon||`` (Angry Face) inside ``||input:on shake||``.
```blocks
basic.showIcon(IconNames.Target)
input.onGesture(Gesture.Shake, function () {
    basic.showIcon(IconNames.Angry)
})
```

## CONCEPT: VARIABLES (The Digital Switch) @unplugged

To stop the alarm from ringing on you, we need a **VARIABLE**.


A _variable_ is like a digital box where the computer stores information. Today, we are going to use a variable like a **Light Switch**. We can flip it to **TRUE** (ON) or **FALSE** (OFF).

We will name our switch ** `Alarm_Is_On` **.

## Step 2: Create the Switch

Let's build that switch!

Click on the red `||variables:Variables||` drawer. Click the **Make a Variable** button and type in the name: **Alarm_Is_On**.

```blocks
let _item = 0
```

## Step 3: Arm the System (Button B)

We want Button B to _turn on_ the alarm.

Grab an `||input:on button A pressed||` block and change the 'A' to 'B'.

Inside it, go to Variables and grab `||variables:set Alarm_Is_On to||`.

Go to the green `||logic:Logic||` drawer, grab the `||logic:true||` block, and snap it in.

Code snippet

```block
let Alarm_Is_On = false
input.onButtonPressed(Button.B, function () {
    Alarm_Is_On = true
})
```

## Step 4: Disarm the System (Button A)

Now we need our secret disarm password!

Grab another `||input:on button A pressed||` block.

Inside it, add another `||variables:set Alarm_Is_On to||` block.

Go to Logic, grab the `||logic:false||` block, and snap it in.

Code snippet

```block
let Alarm_Is_On = false
input.onButtonPressed(Button.A, function () {
    Alarm_Is_On = false
})
```

## CONCEPT: THE BRAIN @unplugged

Right now, the computer knows the switch is being flipped, but the Shake Sensor doesn't care! It will still ring every time.

Remember our **CONDITION** (IF / THEN) rule from Win 1? We must tell the computer's brain: _"ONLY show the angry face IF the alarm is turned on."_

## Step 5: The IF Statement

Go to the green `||logic:Logic||` drawer and grab an `||logic:if true then||` block.

Put it _inside_ your `||input:on shake||` block.

Finally, move your angry face block _inside_ the IF statement.

```block
let Alarm_Is_On = false
input.onGesture(Gesture.Shake, function () {
    if (true) {
        basic.showIcon(IconNames.Angry)
    }
})
```

## Step 6: Connect the Switch

Now, let's connect our switch to the brain!

Go to `||variables:Variables||`, grab the round `||variables:Alarm_Is_On||` block, and drop it directly over the word **true** inside your IF statement.

```block
let Alarm_Is_On = false
input.onGesture(Gesture.Shake, function () {
    if (Alarm_Is_On) {
        basic.showIcon(IconNames.Angry)
    }
})
```

## Step 7: Test your Password!

Test it on the simulator!

1. Click **SHAKE**. (Nothing happens! You are safe.)
    
2. Click **Button B** to arm the system.
    
3. Click **SHAKE**. (Angry face! Intruder caught!)
    
4. Click **Button A** to disarm it again.
    

## TASK: Add your own magic

Amazing logic, Pioneer! Your room is now safe for you, but trapped for intruders.

Click the **Done** button in the next step to open the full Makecode interface.

Can you add a `||basic:clear screen||` block to Button A so the angry face goes away when you disarm it?

## Step 8: Win 2 Complete! @unplugged

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif) 

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!
