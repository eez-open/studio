# DESCRIPTION

Performs one or more LVGL specific actions.

# PROPERTIES

## Actions

List of actions to be executed. The following actions are available:

- **Change Screen**: Change the screen to the specified screen
  - *Screen*: The screen to change to
  - *Fade mode*: Selection of animation when moving from the previous page to a new page
  - *Speed*: Animation duration in milliseconds
  - *Delay*: Delay in milliseconds before the animation starts.
  - *Use stack*: Put active screen on the stack.

- **Change to Previous Screen**: Change to the previous screen
  - *Fade mode*: Selection of animation when moving from the previous page to a new page
  - *Speed*: Animation duration in milliseconds
  - *Delay*: Delay in milliseconds before the animation starts.

- **Create Screen**: Create the screen ("Screens lifetime support" should be enabled in Settings - Build)"
  - *Screen*: The screen to create

- **Delete Screen**: Delete the screen ("Screens lifetime support" should be enabled in Settings - Build)"
  - *Screen*: The screen to delete

- **Is Screen Created**: Check if screen is created ("Screens lifetime support" should be enabled in Settings - Build)"
  - *Screen*: The screen
  - *Store result into*: The boolean variable where to store the screen status

- **Obj Set X**: Set the x coordinate of the object
  - *Object*: The object to set the x coordinate
  - *X*: The x coordinate to set

- **Obj Get X**: Get the x coordinate of the object
  - *Object*: The object to get the x coordinate
  - *Store result into*: The variable to store the x coordinate

- **Obj Set Y**: Set the y coordinate of the object
  - *Object*: The object to set the y coordinate
  - *Y*: The y coordinate to set

- **Obj Get Y**: Get the y coordinate of the object
  - *Object*: The object to get the y coordinate
  - *Store result into*: The variable to store the y coordinate

- **Obj Set Width**: Set the width of the object
  - *Object*: The object to set the width
  - *Width*: The width to set

- **Obj Get Width**: Get the width of the object
  - *Object*: The object to get the width
  - *Store result into*: The variable to store the width

- **Obj Set Height**: Set the height of the object
  - *Object*: The object to set the height
  - *Height*: The height to set

- **Obj Get Height**: Get the height of the object
  - *Object*: The object to get the height
  - *Store result into*: The variable to store the height

- **Obj Set Style Opa**: Set the opacity of the object
  - *Object*: The object to set the opacity
  - *Opacity*: The opacity to set (0-255)

- **Obj Get Style Opa**: Get the opacity of the object
  - *Object*: The object to get the opacity
  - *Store result into*: The variable to store the opacity

- **Obj Add Style**: Add a style to the object
  - *Object*: The object to add the style
  - *Style*: The style to add

- **Obj Remove Style**: Remove a style from the object
  - *Object*: The object to remove the style
  - *Style*: The style to remove

- **Obj Set Flag Hidden**: Set the hidden flag of the object
  - *Object*: The object to set the hidden flag
  - *Hidden*: The hidden flag value

- **Obj Add Flag**: Add a flag to the object
  - *Object*: The object to add the flag
  - *Flag*: The flag to add

- **Obj Clear Flag**: Clear a flag from the object
  - *Object*: The object to clear the flag
  - *Flag*: The flag to clear

- **Obj Has Flag**: Check if the object has the specified flag
  - *Object*: The object to check the flag
  - *Flag*: The flag to check
  - *Store result into*: The variable to store the result

- **Obj Set State Checked**: Set the checked state of the object
  - *Object*: The object to set the checked state
  - *Checked*: The checked state to set

- **Obj Set State Disabled**: Set the disabled state of the object
  - *Object*: The object to set the disabled state
  - *Disabled*: The disabled state to set

- **Obj Add State**: Add a state to the object
  - *Object*: The object to add the state
  - *State*: The state to add

- **Obj Clear State**: Clear a state from the object
  - *Object*: The object to clear the state
  - *State*: The state to clear

- **Obj Has State**: Check if the object has the specified state
  - *Object*: The object to check the state
  - *State*: The state to check
  - *Store result into*: The variable to store the result

- **Arc Set Value**: Set the value of the arc
  - *Object*: The arc to set the value
  - *Value*: The value to set

- **Bar Set Value**: Set the value of the bar
  - *Object*: The bar to set the value
  - *Value*: The value to set (0-100)
  - *Animated*: Use animation when setting the value

- **Calendar Set Today Date**: Set the today's date
  - *Object*: The calendar object
  - *Year*: Today's year
  - *Month*: Today's month [1..12]
  - *Day*: Today's day [1..31]

- **Calendar Set Showed Date**: Set the currently showed
  - *Object*: The calendar object
  - *Year*: Showed year
  - *Month*: Showed month [1..12]

- **Calendar Set Highlighted Date**: Set the highlighted date
  - *Object*: The calendar object
  - *Year*: Highlight year
  - *Month*: Highlight month [1..12]
  - *Day*: Hilighy day [1..31]

- **Calendar Get Pressed Date**: Get the currently pressed day
  - *Object*: The calendar object
  - *Store year into*: The integer variable where to store the year
  - *Store month into*: The integer variable where to store the month (1..12)
  - *Store day into*: The integer variable where to store the day (1..31)

- **Dropdown Set Selected**: Set the selected item of the dropdown
  - *Object*: The dropdown to set the selected item
  - *Selected*: The index of the selected item

- **Image Set Src**: Set the source image of the image
  - *Object*: The image to set the source
  - *Src*: The source image to set given as a string

- **Image Set Angle**: Set the angle of the image
  - *Object*: The image to set the angle
  - *Angle*: The angle to set. Angle has 0.1 degree precision, so for 45.8° set 458.

- **Image Set Zoom**: Set the zoom of the image
  - *Object*: The image to set the zoom
  - *Zoom*: The zoom to set. Set factor to 256 to disable zooming. A larger value enlarges the images (e.g. 512 double size), a smaller value shrinks it (e.g. 128 half size).

- **Label Set Text**: Set the text of the label
  - *Object*: The label to set the text
  - *Text*: The text to set

- **Roller Set Selected**: Set the selected item of the roller
  - *Object*: The roller to set the selected item
  - *Selected*: The index of the selected item
  - *Animated*: Use animation when setting the selected item

- **Slider Set Value**: Set the value of the slider
  - *Object*: The slider to set the value
  - *Value*: The value to set
  - *Animated*: Use animation when setting the value

- **Keyboard Set Textarea**: Set the textarea for the keyboard
  - *Object*: The keyboard to set the textarea
  - *Textarea*: The textarea to set

- **Group Focus Obj**: Focus the object
  - *Object*: The object to focus

- **Group Focus Next**: Focus the next object in the group
  - *Group*: The group to focus the next object

- **Group Focus Prev**: Focus the previous object in the group
  - *Group*: The group to focus the previous object

- **Group Get Focused**: Get the focused object in the group
  - *Group*: The group to get the focused object
  - *Store result into*: The variable to store the focused object

- **Group Focus Freeze**: Do not let to change the focus from the current object
  - *Group*: The group to freeze/unfreeze the focus
  - *Enabled*: true: freeze, false: release freezing (normal mode)

- **Group Set Wrap**: Set whether focus next/prev will allow wrapping from first->last or last->first object.
  - *Group*: The group to set the wrap
  - *Enabled*: true: wrap, false: no wrap

- **Group Set Editing**: Manually set the current mode (edit or navigate).
  - *Group*: The group to set the editing mode
  - *Enabled*: true: edit mode, false: navigate mode

- **Anim X**: Animate the x coordinate of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim Y**: Animate the y coordinate of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim Width**: Animate the width of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim Height**: Animate the height of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim Opacity**: Animate the opacity of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim Image Zoom**: Animate the zoom of the image
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim Image Angle**: Animate the angle of the image
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path


# INPUTS

## seqin

A standard sequence input.

# OUTPUTS

## seqout

A standard sequence output.

# EXAMPLES

-   _Change Screen_
