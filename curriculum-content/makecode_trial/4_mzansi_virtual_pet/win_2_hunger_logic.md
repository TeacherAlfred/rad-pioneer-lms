# Win 2: Hunger Logic

## Welcome @unplugged
Your Springbok is alive and looking happy! But living creatures require energy, Pioneer.
<br><br>
Right now, your pet will stay at a Happiness level of 10 forever. We need to build a **Background Process** that makes your Springbok get hungry (and sad) over time!

## Step 0: System Restore
Because you are entering a new secure workspace, your previous code has been cleared. Let's restore your pet's brain!
<br><br>
**Click the blue lightbulb icon below** to see the blueprint. Rebuild these blocks to get your emotion engine running again, then click **Next**.

```blocks
let Happiness = 10
basic.showIcon(IconNames.Giraffe)

basic.forever(function () {
    if (Happiness > 5) {
        basic.showIcon(IconNames.Happy)
    } else {
        basic.showIcon(IconNames.Sad)
    }
})
```

## CONCEPT: Background Processes & Constraints @unplugged

Did you know the micro:bit can do multiple things at exactly the same time? We can run a _second_ `forever` loop acting as a hidden timer (a **Background Process**) while our first loop handles the face on the screen!

  
  

We also need to learn about **Constraints**. If we subtract 1 from Happiness every few seconds forever, eventually your pet's happiness will drop to -1000! That makes the game impossible to win. We will use an `if` block to create a "floor" so Happiness never drops below 0.

## Step 1: The Hunger Timer

Let's build the metabolism engine!

  

1. From the blue `||basic:Basic||` drawer, drag out a new `||basic:forever||` loop.
    
2. Grab a `||basic:pause (100) ms||` block and put it inside. Change it to **5000 ms** (This is 5 seconds).
    
3. Open the red `||variables:Variables||` drawer and grab the `||variables:change [Happiness] by 1||` block.
    
4. Drop it _under_ the pause block, and change the **1** to **-1**.
    

_Now, every 5 seconds, your pet loses 1 Happiness point._

```blocks
basic.forever(function () {
    basic.pause(5000)
    Happiness += -1
})
```

## Step 2: Setting the Constraint (The Floor)

Let's stop the number from going into the negatives!

  

1. Go to the teal `||logic:Logic||` drawer and grab an `||logic:if||` block. Drop it directly under your `change` block.
    
2. Grab a `||logic:0 < 0||` block and snap it into the `if` statement's condition.
    
3. Put the `||variables:Happiness||` variable into the first **0**.
    
4. Inside the `if` block, add a `||variables:set [Happiness] to 0||` block.
    

_Your rule now asks: Did Happiness drop below 0? If YES, force it back to 0!_

```blocks
basic.forever(function () {
    basic.pause(5000)
    Happiness += -1
    if (Happiness < 0) {
        Happiness = 0
    }
})
```

## TASK: Wait and Watch @unplugged

Look at your MakeCode simulator. Your Springbok should be smiling.

Now... just wait. Count to 5. The hidden timer is running!

Every 5 seconds, the background process subtracts 1. Since we start at 10, it will take exactly **25 seconds** for Happiness to drop to 5. Once it hits 5, your first loop will instantly detect the change and swap the face to **Sad**!

## SUBMISSION: Win 2 Complete! @unplugged

Excellent engineering! You now have two separate loops working together to manage complex data states over time.

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!