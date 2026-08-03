# Win 3: Velocity & Gravity

## Welcome @unplugged
We have traffic, Pioneer! But right now it looks more like a parking lot. 
<br><br>
To make this a true Dodging Game, we need to add **Velocity** so the enemy cars drive down the screen toward your Taxi!

## Step 0: System Restore
Because you are entering a new secure workspace, your previous code has been cleared. Let's restore it!
<br><br>
**Click the blue lightbulb icon below** to see the blueprint. Rebuild these blocks to restore your Player Taxi and Enemy Spawner, then click **Next**.

```blocks
let Taxi: game.LedSprite = null
let Enemy: game.LedSprite = null

Taxi = game.createSprite(2, 4)

input.onButtonPressed(Button.A, function () {
    Taxi.change(LedSpriteProperty.X, -1)
})
input.onButtonPressed(Button.B, function () {
    Taxi.change(LedSpriteProperty.X, 1)
})

basic.forever(function () {
    Enemy = game.createSprite(randint(0, 4), 0)
    basic.pause(1000)
})
```

## CONCEPT: Velocity @unplugged

**Velocity** is speed + direction.

To make cars move down the screen, we need to constantly change their Y-coordinate. By adding 1 to their Y position over and over again, they will look like they are driving toward the bottom of the grid!

## Step 1: The Physics Engine

We need a _second_ forever loop to act as our physics engine (controlling movement independently from our spawner).

1. From the blue `||basic:Basic||` drawer, drag a new `||basic:forever||` loop onto your workspace.
2. Go to the green `||game:Game||` drawer and grab the `||game:sprite change x by 1||` block. Drop it in the new loop.
3. Change the variable from `sprite` to `Enemy`.
4. Click the dropdown that says **x** and change it to **y**! (We want them to move down, not right).

Code snippet

```blocks
basic.forever(function () {
    Enemy.change(LedSpriteProperty.Y, 1)
})
```

## Step 2: The Speed Limit (Frame Rate)

Right now, the cars will teleport to the bottom of the screen instantly! Computers are simply too fast. We need to tell the game how many "frames" to show per second.

1. Grab a `||basic:pause (100) ms||` block and drop it _under_ the change block in your physics loop.
2. Set it to **200 ms**. This creates a nice, steady driving speed for the traffic.

Code snippet

```blocks
basic.forever(function () {
    Enemy.change(LedSpriteProperty.Y, 1)
    basic.pause(200)
})
```

## TASK: Simulator Testing @unplugged

Check your simulator! The cars should now spawn randomly at the top and drive down toward your Taxi.

_Try dodging them with Button A and B!_

**But wait... do you see the glitch?** When the cars reach the bottom, they just get stuck there in a bright pile! This is a massive problem for the computer's memory. We will fix it in our final Win.

## SUBMISSION: Win 3 Complete! @unplugged

You have successfully created a state-tracking emotion engine!

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!
