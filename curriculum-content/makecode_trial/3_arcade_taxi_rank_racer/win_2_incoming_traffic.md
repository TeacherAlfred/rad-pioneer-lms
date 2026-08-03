# Win 2: Incoming Traffic

## Welcome @unplugged
Your taxi is fueled up and ready, Pioneer! But a racing game without traffic isn't much of a race.
<br><br>
We need to spawn enemy cars at the top of the screen and make sure they appear in random lanes to keep the player guessing!

## Step 0: System Restore
Because you are entering a new secure workspace, your previous code has been cleared. Let's restore your taxi!
<br><br>
**Click the blue lightbulb icon below** to see the blueprint. Rebuild these blocks to get your player back on the grid, then click **Next**.

```blocks
let Taxi: game.LedSprite = null

Taxi = game.createSprite(2, 4)

input.onButtonPressed(Button.A, function () {
    Taxi.change(LedSpriteProperty.X, -1)
})

input.onButtonPressed(Button.B, function () {
    Taxi.change(LedSpriteProperty.X, 1)
})
```

## CONCEPT: Randomization @unplugged

To make a game fun, it needs to be unpredictable. If the cars always spawned in the exact same spot, the game would be too easy.

We will use a **Math** block called **`pick random`** to choose a random *lane (X-coordinate)* between 0 and 4 every time a new car is created.

We will lock the Y-coordinate to **0** so they always spawn at the very top of the screen.

## Step 1: The Spawner Engine

Let's create a background engine that constantly spawns traffic.

1. From the blue `||basic:Basic||` drawer, drag out a `||basic:forever||` loop.
2. Click the red `||variables:Variables||` drawer and make a new variable named **`Enemy`**.
3. Drag `||variables:set [Enemy] to 0||` into your `forever` loop.
4. From the green `||game:Game||` drawer, grab the `||game:create sprite at x: 2 y: 2||` block and drop it over the **0**.

```blocks
let Enemy: game.LedSprite = null
basic.forever(function () {
    Enemy = game.createSprite(2, 2)
})
```

## Step 2: Random Lanes

Now we randomize the spawn location!

1. Change the **Y** value in your create sprite block to **0**.
2. Open the purple `||math:Math||` drawer and find the `||math:pick random 0 to 10||` block.
3. Drag it into the **X** value of your sprite block!
4. Change the 10 to **4** (because our grid only goes from 0 to 4).

```blocks
let Enemy: game.LedSprite = null
basic.forever(function () {
    Enemy = game.createSprite(randint(0, 4), 0)
})
```

## Step 3: Traffic Control

If we leave the loop like this, it will spawn a thousand cars a second and completely freeze our micro:bit! We need to control the flow of traffic.

From the `||basic:Basic||` drawer, drag a `||basic:pause (100) ms||` block to the bottom of your `forever` loop. Change it to **1000 ms** (1 second).

```
let Enemy: game.LedSprite = null
basic.forever(function () {
    Enemy = game.createSprite(randint(0, 4), 0)
    basic.pause(1000)
})
```

## TASK: Check the Simulator @unplugged

Look at the screen! Every 1 second, a new enemy car should appear at the top of the grid in a random lane.

But wait... they are just parking there! In the next Win, we will add Velocity to make them drive toward you.

## SUBMISSION: Win 2 Complete! @unplugged

You have successfully created a state-tracking emotion engine!

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!
