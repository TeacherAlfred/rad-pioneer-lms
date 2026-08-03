# Skill 1: The Temperature Tracker

## Welcome @unplugged
Welcome Pioneer!<br>
Today we are using the **Temperature & Humidity Sensor**.<br>
This single sensor can measure two different things: heat and moisture!


## Step 1: The Trigger
Let's start by measuring just the Temperature. 
Grab an ``||input:on button A pressed||`` block from the pink ``||input:Input||`` drawer.

## Step 2: Reading the Heat
Grab a ``||basic:show number||`` block and place it inside your button block. 
Then, open your new ``||IoT_keyestudio:IoT_keyestudio||`` drawer. Find the round block that says ``||IoT_keyestudio:Temperature(℃)||`` and drag it over the `0` inside your show number block!

```blocks
input.onButtonPressed(Button.A, function () {
    basic.showNumber(0)
})
```


## [OPTIONAL] Test it with real hardware!

1. Plug your motor into **Pin 1** (P1).
2. Connect your USB and click **Download**.
3. Here is what should happen:<br>
Press Button A. The motor should instantly switch on and spin at maximum speed.<br>
Now, press Button B. The motor should stop spinning.

## TASK: Add you own magic
Click the Done button in the next step to open the full Makecode interface.<br>
**Challenge:** 

## Submission: Upload your link on the RAD Academy task @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!

```package
neopixel=github:microsoft/pxt-neopixel
```

<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>