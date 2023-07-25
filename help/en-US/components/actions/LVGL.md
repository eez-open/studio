# DESCRIPTION

Performs one or more LVGL specific actions.

# PROPERTIES

## Actions

List of actions to be executed. The following actions are available:

- `Change Screen`
    Changes the active page. The following options are available:
     - `Previous screen` - if it is checked, it will go to the previous screen, otherwise you should select the page you want to display.
     - `Screen` - name of the page to be displayed.
     - `Fade mode'` - selection of animation when moving from the previous page to a new page. The following options are available:
         - `None` - switch immediately after delay ms
         - `Over left / Over right / Over top / Over bottom` - move the new page over the others towards the given direction.
         - `Move Left/Right/Top/Bottom` - move both the old and new pages towards the given direction.
         - `Fade in / Fade out` - fade the new page over the old page, or vice versa.
         - `Out left / Out right / Out top / Out bottom` - move out the old page over the current one towards the given direction.
     - `Speed` - animation duration in milliseconds.
     - `Delay` - delay in milliseconds before the animation starts.  

- `Play Animation`
    Animates the selected Widget property. The following options are available:

   - `Target` - Widget whose property is animated
   - `Property` - Widget property that is animated.
   - `Start` - initial property value.
   - `End` - the final value of the property.
   - `Delay` - delay in milliseconds before the animation starts.
   - `Time` - the total duration of the animation in milliseconds.
   - `Relative` - determines whether `Start` and `End` values are relative to the current value or are absolute values.
   - `Instant` - if checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts.
   - `Path` - determines the animation curve. The following options are available:
      - `Linear` - calculate the current value of an animation applying linear characteristic
      - `Ease in` - calculate the current value of an animation slowing down the start phase
      - `Ease out` - calculate the current value of an animation slowing down the end phase
      - `Ease in out` - calculate the current value of an animation applying an "S" characteristic (cosine)
      - `Overshoot` - calculate the current value of an animation with overshoot at the end
      - `Bounce` - calculate the current value of an animation with 3 bounces

- `Set Property`
    Changes the value of the selected property for the selected Widget. The following options are available:
     - `Target type` - The type of Widget that changes.
     - `Target` - Widget whose property is changed.
     - `Property` - the property that is being changed.
     - `Value` - new property value.
     - `Animated` - if there is a possibility to animate the property, then you can choose to make the change animated. For example for _Slider_, changing position _slider_ (Value property) can be animated.

# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

- _Change Screen_
