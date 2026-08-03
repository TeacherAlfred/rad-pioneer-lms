# Win 2: The Grid Monitor

## Welcome @unplugged
Excellent work, Pioneer! Your Darkness Detector is fully operational. 
<br><br>
But wait... your light turns on *every time* the room gets dark, even if the electricity is working!
<br>
*We only want the emergency light to turn on during actual load shedding.*
<br><br>
To fix this, we need to build an **Electricity Monitor** to keep track of the electricity status.

## CONCEPT: Variables and State @unplugged
How does a computer "remember" things? It uses a **Variable**!
<br>
We use **variables** to store information (*data*).
<br><br>
A **Variable** is like a digital box with a label on it. We can put data inside the box, and the computer will remember it for us.
<br><br>
In this Win, we will create a variable to store the **State** of the power grid.
* State 1: The power is **ON** (TRUE).
* State 2: The power is **OFF** (FALSE).

## Step 1: Create the Variable
Let's create our digital box.
<br>
Click the red ``||variables:Variables||`` drawer and click **Make a Variable...**
<br><br>
Name your new variable `Grid_Power` and click OK.

```blocks
let name = 0
```

## Step 2: The Power Buttons
We need a way to tell the micro:bit when load shedding starts and stops. We will use the A and B buttons.
<br>
From the pink ``||input:Input||`` drawer, drag out two ``||input:on button pressed||`` blocks. Set one to **A** and the other to **B**.

```blocks
input.onButtonPressed(Button.A, function () {
})
input.onButtonPressed(Button.B, function () {
})
```

## Step 3: Setting the State (TRUE / FALSE)
Now, let's put data into our variable when we press the buttons!
From the red `||variables:Variables||` drawer, drag a `||variables:set [Grid_Power] to 0||` block into **both** of your button blocks.

```blocks
input.onButtonPressed(Button.A, function () {
    Grid_Power = 0
})
input.onButtonPressed(Button.B, function () {
    Grid_Power = 0
})
```

## Step 4: Boolean Logic
Wait, the power grid isn't a number (0)! It's either ON or OFF.
In programming, we call ON and OFF **TRUE** and **FALSE**. This is called **Boolean Logic**.
Go to the teal `||logic:Logic||` drawer and scroll to the bottom. Grab a `||logic:true||` block and a `||logic:false||` block.
Drop them over the **0**s in your `set` blocks. Make Button A set the grid to **FALSE** (Power Out!) and Button B set it to **TRUE** (Power Restored!).

```blocks
let Grid_Power = false
input.onButtonPressed(Button.A, function () {
    Grid_Power = false
})
input.onButtonPressed(Button.B, function () {
    Grid_Power = true
})
```

## TASK: Add Visual Feedback

Right now, the micro:bit "remembers" the power state, but it doesn't _show_ us anything when we press the buttons!
<br>
**Challenge:** Can you add a `||basic:show icon||` block inside your Button A and Button B blocks?
- When Button A is pressed (Power Out), show an 'X'.
- When Button B is pressed (Power Restored), show a Checkmark.
   
```
let Grid_Power = false
input.onButtonPressed(Button.A, function () {
    Grid_Power = false
    basic.showIcon(IconNames.No)
})
input.onButtonPressed(Button.B, function () {
    Grid_Power = true
    basic.showIcon(IconNames.Yes)
})
```

## SUBMISSION: Win 2 Complete! @unplugged

You have successfully built a state-tracking engine! Your micro:bit now remembers if the city has power.

When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.

Watch the video below if you need help with the steps.

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Initiate Final Uplink**!
````