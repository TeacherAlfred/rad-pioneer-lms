
# Win 3: The Feeding Habit

## Welcome @unplugged
Your Springbok's metabolism is officially running! But if we just sit here, it is going to get sad and stay sad. 
<br><br>
It is time to step in as the caretaker. We need to program a way for you to interact with your pet and *feed it* to bring its Happiness back up!

## Step 0: System Restore
Let's bring your pet back online!
<br><br>
**Click the blue lightbulb icon below**, copy the blocks to rebuild your Springbok's emotion brain and hunger timer, and get ready to add the feeding interaction.

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

basic.forever(function () {
    basic.pause(5000)
    Happiness += -1
    if (Happiness < 0) {
        Happiness = 0
    }
})
```

## CONCEPT: Upper Constraints (The Ceiling) @unplugged

In Win 2, you built a **Floor Constraint** to stop Happiness from dropping below 0.

Now, we need to build a **Ceiling Constraint**. If you feed your Springbok 100 times, its Happiness shouldn't go up to 200! We want the maximum health to be exactly 10. If the number goes over 10, our code must immediately pull it back down to 10.

## Step 1: The Feeding Trigger

Let's use a physical button to trigger the feeding process.

1. Go to the pink `||input:Input||` drawer and grab an `||input:on button A pressed||` block.
    
2. Open the red `||variables:Variables||` drawer and grab a `||variables:change [Happiness] by 1||` block. Drop it inside the button block.
    
3. Change the **1** to **2**. (Food gives a big boost!)

```blocks
input.onButtonPressed(Button.A, function () {
    Happiness += 2
})
```

## Step 2: Setting the Ceiling

Now we add the logic to prevent overfeeding!

1. Go to the teal `||logic:Logic||` drawer and grab an `||logic:if||` block. Drop it directly under your  `||variables:change [Happiness] by 2||` block.
    
2. Grab a `||logic:0 < 0||` block and snap it into the `if` statement's condition. Change the **`<`** sign if you need to so that your code says  `||logic:0 > 0||`.
    
3. Put the `||variables:Happiness||` variable into the first **0**. Change the second **0** to **10**.
    
4. Inside the `if` block, add a `||variables:set [Happiness] to 0||` block, and change the **0** to **10**.

_Your rule now asks: Did Happiness go above 10? If YES, force it back to 10!_

```blocks
input.onButtonPressed(Button.A, function () {
    Happiness += 2
    if (Happiness > 10) {
        Happiness = 10
    }
})
```

## TASK: Be the Caretaker! @unplugged

Look at your MakeCode simulator! Your digital pet is fully interactive. Let's test the entire system:

1. Wait **25 seconds** without clicking anything. Watch the screen change to a **Sad Face** as the hunger timer runs down.
    
2. Once it is sad, click **Button A** three or four times to feed it.
    
3. _Instantly_, the face should change back to a **Happy Face** because you boosted the variable back over 5!
    
4. **Test the Ceiling:** Spam Button A 20 times. Wait 5 seconds. Does it become sad immediately? (It shouldn't! Because of your ceiling constraint, the happiness stopped at 10. When the timer ticked down, it went to 9, keeping the pet happy!)
    

## SUBMISSION: Win 3 Complete! @unplugged

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!