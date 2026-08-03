# Win 1: The Virtual Springbok

## Welcome @unplugged
Welcome to the digital wildlife reserve, Pioneer! 
<br><br>
Your mission is to code and raise a virtual Springbok that actually feels the environment around it. Just like a real animal, your digital pet will have feelings and will need to be taken care of. 
<br><br>
First, we need to bring your Springbok to life and give it a digital brain that remembers its mood!

## CONCEPT: Data State @unplugged
How do we make a computer feel "happy" or "sad"? We use a **`Variable`** to track its **Data State**.
<br><br>
By storing a number inside a variable, we create a **State**. 
* If our `Happiness` variable is a high number (like 10), the pet is feeling great. 
* If the number drops too low, the pet becomes sad. 
<br><br>
Our code will constantly check this ** *"State"* ** and change the face on the screen so we know how our pet is feeling!

## Step 1: Hatching the Pet
Let's create your pet and set its starting mood!
<br>
1. Go to the red `||variables:Variables||` drawer and click **Make a Variable...**. Name it **`Happiness`**.
2. Drag the `||variables:set [Happiness] to 0||` block into your `||basic:on start||` block.
3. Change the **0** to **10** (Your pet starts out perfectly happy!).
4. Open the blue `||basic:Basic||` drawer and grab a `||basic:show icon||` block. Click the heart and change it to an animal (like the Giraffe) to represent your Springbok being born.

```blocks
let Happiness = 10
basic.showIcon(IconNames.Giraffe)
```

## Step 2: The Emotion Engine

Now we need a background brain that constantly checks on the pet's mood.

1. From the `||basic:Basic||` drawer, drag out a `||basic:forever||` loop.
    
2. Go to the teal `||logic:Logic||` drawer and drop an `||logic:if / else||` block inside the `||basic:forever||` loop.
    
```blocks
basic.forever(function () {
    if (true) {
        
    } else {
        
    }
})
```

## Step 3: Checking the State

Let's teach the engine how to read the `Happiness` level!

1. From the `||logic:Logic||` drawer, grab the `||logic:0 < 0||` comparison block. Drop it where it says **true**.
1.1 Change the `||logic:0 < 0||` to say `||logic:0 > 0||`
2. Go to `||variables:Variables||` and drop `||variables:Happiness||` into the first **0**.
    
3. Change the second **0** to **5**.

_Your rule now asks: Is Happiness greater than 5?_

```blocks
basic.forever(function () {
    if (Happiness > 5) {
        
    } else {
        
    }
})
```

## Step 4: Showing Emotion

Time to display the results!

1. Grab a `||basic:show icon||` block and put it in the top of your `if` statement. Change it to a **Happy Face**.
    
2. Grab another `||basic:show icon||` block and put it in the `else` section. Change it to a **Sad Face**.

```blocks
basic.forever(function () {
    if (Happiness > 5) {
        basic.showIcon(IconNames.Happy)
    } else {
        basic.showIcon(IconNames.Sad)
    }
})
```

## TASK: Test the Mood Logic @unplugged

Look at your MakeCode simulator! The screen should flash your animal icon, and then immediately switch to a Happy Face (because 10 is greater than 5).

**Challenge:** Go back to your `on start` block and manually change your starting `Happiness` to **3**. Look at the simulator again. Does your pet instantly become sad?

_(Don't forget to change it back to 10 when you are done testing!)_

## SUBMISSION: Win 1 Complete! @unplugged

You have successfully created a state-tracking emotion engine!

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!