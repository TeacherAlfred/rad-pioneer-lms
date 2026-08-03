# Win 4: The Memory Leak!

## Welcome @unplugged
Pioneer, we have a critical system warning! 
<br><br>
When your enemy cars drive off the bottom of the screen (Y = 4), you can't see them anymore, but they *still exist* in the computer's memory! This is called a **Memory Leak**. 
<br><br>
If we don't destroy the old data, the computer's brain will slowly fill up with invisible cars until the game crashes!

## Step 0: System Restore
Let's bring back our code from Win 3. 
<br><br>
**Click the blue lightbulb icon below**, copy the blocks to rebuild your physics engine and spawner, and get ready for the final fix!

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

basic.forever(function () {
    Enemy.change(LedSpriteProperty.Y, 1)
    basic.pause(200)
})
```

## CONCEPT: Garbage Collection @unplugged

In professional game design, getting rid of old data is called **Garbage Collection**.

  
  

We need to write a rule: ** *IF* ** a car reaches the very bottom of the grid (Y = 4), we must DELETE it from memory completely to keep the game running fast and smooth.

## Step 1: The Garbage Collector

Let's add our memory wipe rule inside the physics engine (your second `forever` loop).

  

1. Go to the teal `||logic:Logic||` drawer, grab an `||logic:if||` block, and drop it _under_ the `||game:Enemy change y by -1||`.
    
2. Grab a `||logic:0 = 0||` block and put it in the `if` statement's condition.
    
3. From the `||game:Game||` drawer, drag the `||game:sprite x||` block into the first **0**. Change `sprite` to `Enemy` and click `x` to change it to `y`.
    
4. Change the second **0** to **4**.
    

_Your rule now asks: Did the Enemy reach Y: 4?_

Code snippet

```blocks 
let Enemy: game.LedSprite = null
basic.forever(function () {
    Enemy.change(LedSpriteProperty.Y, 1)
    basic.pause(200)
    if (Enemy.get(LedSpriteProperty.Y) == 4) {
        
    }
})
```

## Step 2: Delete the Sprite

Now we execute the garbage collection!

  

From the `||game:Game||` drawer, grab the `||game:delete sprite||` block. Drop it inside the **`if`** block, and ensure the variable is set to **`Enemy`**.

```blocks
let Enemy: game.LedSprite = null
basic.forever(function () {
    Enemy.change(LedSpriteProperty.Y, 1)
    basic.pause(200)
    if (Enemy.get(LedSpriteProperty.Y) == 4) {
        Enemy.delete()
    }
})
```

## Step 3: Collision Detection (Game Over!)

A dodging game needs a way to lose! We need to check if the Enemy hits the Taxi _before_ it gets deleted.

  

1. Grab another `||logic:if||` block and drop it right _above_ the garbage collector `if` block.
    
2. From the `||game:Game||` drawer, find the `||game:sprite is touching||` block and drop it into the `true` slot.
    
3. Make it say `||game:Enemy is touching Taxi||`.
    
4. Finally, open the `||game:Game||` drawer one last time, find the `||game:game over||` block, and place it inside this new `if` block!
    

Code snippet

```blocks
let Enemy: game.LedSprite = null
basic.forever(function () {
    Enemy.change(LedSpriteProperty.Y, 1)
    basic.pause(200)
    if (Enemy.isTouching(Taxi)) {
        game.gameOver()
    }
    if (Enemy.get(LedSpriteProperty.Y) == 4) {
        Enemy.delete()
    }
})
```

## TASK: Playtest the Game! @unplugged

Look at your MakeCode simulator. Your Taxi Rank Racer is fully operational!

  

1. Use **Button A** and **Button B** to dodge the incoming traffic.
    
2. Notice how the traffic now smoothly disappears when it reaches the bottom of the screen (Garbage Collection is working!).
    
3. Let a car hit you. The screen should flash **GAME OVER** and display your score!
    

## SUBMISSION: Mission Accomplished! @unplugged

You have built a fully functional Arcade game. You mastered the X/Y grid, created a physics engine, built a random spawner, and manually programmed garbage collection to stop a memory leak!

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!