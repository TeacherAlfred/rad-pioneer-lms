
# Win 1: The Player Taxi

## Welcome @unplugged
Welcome to the Arcade, Pioneer! 
<br><br>
The local taxi rank is absolute chaos today. Your mission is to build a top-down dodging game to navigate through the madness. Before we can spawn the incoming traffic, we need to get your taxi onto the map and ready to drive!

## CONCEPT: The X/Y Grid @unplugged
How does the computer know *exactly* where to put your taxi? It uses a ** *coordinate map* ** called the **X/Y Grid**!
<br><br>
The **`micro:bit`** screen is a grid of 25 LEDs:
* **X-Axis:** Moves Left and Right (from 0 to 4).
* **Y-Axis:** Moves Up and Down (from 0 to 4).
<br><br>
The top-left corner is always `(0, 0)`. To put our taxi at the bottom-middle of the screen, we need to place it at **X: 2** and **Y: 4**.

To put it at the bottom: **`Y = 4`**.<br>
To put it in the middle of the screen: **`X = 2`**.

## Step 1: Spawning the Sprite
In game design, a moving character is called a **Sprite**. Let's spawn (`create`) your taxi!
<br>
1. Click the red `||variables:Variables||` drawer and click **Make a Variable...**. Name it **`Taxi`**.
2. Drag the `||variables:set [Taxi] to 0||` block into your `||basic:on start||` block.
3. Click the green `||game:Game||` drawer (you may need to click '**Advanced**' at the bottom to see it).
4. Grab the `||game:create sprite at x: 2 y: 2||` block and drop it directly on top of the **0** in your `set` block!
5. Change the **Y** value to **4** so your taxi spawns at the bottom of the screen.

```blocks
let Taxi = game.createSprite(2, 4)
```

## Step 2: Steering Left

Now we need to drive! When we steer left, we are moving backward on the X-Axis. That means we need to _subtract_ 1 from our X position.
1. Go to the pink `||input:Input||` drawer and grab an `||input:on button A pressed||` block.
2. From the `||game:Game||` drawer, drag the `||game:sprite change x by 1||` block inside.
3. Click the dropdown on the block and change the variable from `sprite` to `Taxi`.
4. Change the `1` to `-1`.

```blocks
let Taxi: game.LedSprite = null
input.onButtonPressed(Button.A, function () {
    Taxi.change(LedSpriteProperty.X, -1)
})
```

## Step 3: Steering Right

Let's code the right turn! When we move right, we **_add_** 1 to our X position.
1. Grab an `||input:on button B pressed||` block.
2. Drag another `||game:sprite change x by 1||` inside.
3. Change the variable to **`Taxi`**, and leave the value as `1`.

```blocks
let Taxi: game.LedSprite = null
input.onButtonPressed(Button.B, function () {
    Taxi.change(LedSpriteProperty.X, 1)
})
```

## TASK: Test the Game Engine @unplugged

Look at the simulator on your screen. Press Button A and Button B to drive your taxi left and right!

**Notice something cool?**

If you keep pressing Button A, your taxi stops at the edge of the screen instead of disappearing. Because we used a `Sprite` block instead of standard LEDs, the MakeCode Game Engine automatically understands *"collision"* and stops you from driving off the map!

## SUBMISSION: Win 1 Complete! @unplugged

When you are ready _(After clicking the **Done** button)_, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Copy your link, go back to your RAD Lesson window, and click **Verify Build**! We have a taxi... next, we need incoming traffic.

## SUBMISSION: Win 1 Complete! @unplugged

You have successfully created a state-tracking emotion engine!

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!
