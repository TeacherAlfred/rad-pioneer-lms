# Skill 1: The Digital Billboard

## Welcome: The Smart Screen @unplugged
Welcome Pioneer!<br>
Today we are using the **LCD Display**.<br>
Unlike a single LED that just turns on or off, an LCD is a *digital screen* that can output actual text and numbers! This is exactly how smartwatches, microwaves, and calculators talk to us.

## Step 1: Booting up the Screen
Before an LCD can show anything, we have to tell it to turn on when the Micro:bit powers up.<br>
Open the green ``||I2C_LCD1602:I2C_LCD1602||`` drawer and find the ``||I2C_LCD1602:LCD initialize with Address 0||`` block. Drag it inside your ``||basic:on start||`` block.

```blocks
I2C_LCD1602.LcdInit(0)
```

## Step 2: Printing a Message

Now, let's make it say something!

From the same ``||I2C_LCD1602:I2C_LCD1602||`` drawer, grab the `||I2C_LCD1602:I2C_LCD1602.ShowString("Hello", 0, 0)||` block and snap it right under your Init block.

```blocks
I2C_LCD1602.LcdInit(0)
I2C_LCD1602.ShowString("Hello", 0, 0)
```

## Step 3: Customizing your text

Click on the word **"Hello"** and type your own name or a cool robot greeting!

_Note: The ** `x` ** tells the screen how far across to start typing (0-15), and the ** `y` ** tells the screen which row to use (0 is the top row, 1 is the bottom row)._

## [OPTIONAL] Step 4: Test it with real hardware!

1. Plug your **LCD Module** into the special **I2C Port** on your expansion board (It uses 4 wires instead of 3!).
2. Connect your USB and click **Download**.   
3. **Here is what should happen:**
    - The screen should light up and print your custom message perfectly starting at the top-left corner!

## TASK: Add your own magic
Click the **Done** button in the next step to open the full Makecode interface.

**Challenge:** Right now, your screen only uses the top row ** (`y: 0`) **. Can you grab a second `||IoT_keyestudio:ShowString||` block and make the screen say "Hello" on the top row, and your name on the bottom row ** (`y: 1`) **?

## Submission: Upload your link on the RAD Academy task @unplugged
When you are ready *(After clicking the **done** button)*, click the **Share** button at the top of the screen and copy your project to the RAD Platform.
<br>
Watch the video below if you need help with the steps..
<br>

![Click the Share Button](https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/course-assets/guides/makecode_interface/gif_makecode_share.gif)

Copy your link, go back to your RAD Lesson window, and click **Mark Complete**!

```package
IoT_keyestudio=github:keyestudio2019/ks_IoT
```

<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
