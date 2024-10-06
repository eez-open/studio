# DESCRIPTION

Performs one or more LVGL specific actions.

# PROPERTIES

## Actions

List of actions to be executed. The following actions are available:

- **Change screen**: Change the screen to the specified screen
  - *Screen*: The screen to change to
  - *Fade mode*: Selection of animation when moving from the previous page to a new page
  - *Speed*: Animation duration in milliseconds
  - *Delay*: Delay in milliseconds before the animation starts.

- **Change to previous screen**: Change to the previous screen
  - *Fade mode*: Selection of animation when moving from the previous page to a new page
  - *Speed*: Animation duration in milliseconds
  - *Delay*: Delay in milliseconds before the animation starts.

- **Obj set x**: Set the x coordinate of the object
  - *Object*: The object to set the x coordinate
  - *X*: The x coordinate to set

- **Obj get x**: Get the x coordinate of the object
  - *Object*: The object to get the x coordinate
  - *Store result into*: The variable to store the x coordinate

- **Obj set y**: Set the y coordinate of the object
  - *Object*: The object to set the y coordinate
  - *Y*: The y coordinate to set

- **Obj get y**: Get the y coordinate of the object
  - *Object*: The object to get the y coordinate
  - *Store result into*: The variable to store the y coordinate

- **Obj set width**: Set the width of the object
  - *Object*: The object to set the width
  - *Width*: The width to set

- **Obj get width**: Get the width of the object
  - *Object*: The object to get the width
  - *Store result into*: The variable to store the width

- **Obj set height**: Set the height of the object
  - *Object*: The object to set the height
  - *Height*: The height to set

- **Obj get height**: Get the height of the object
  - *Object*: The object to get the height
  - *Store result into*: The variable to store the height

- **Obj set style opa**: Set the opacity of the object
  - *Object*: The object to set the opacity
  - *Opacity*: The opacity to set (0-255)

- **Obj get style opa**: Get the opacity of the object
  - *Object*: The object to get the opacity
  - *Store result into*: The variable to store the opacity

- **Obj add style**: Add a style to the object
  - *Object*: The object to add the style
  - *Style*: The style to add

- **Obj remove style**: Remove a style from the object
  - *Object*: The object to remove the style
  - *Style*: The style to remove

- **Obj set flag hidden**: Set the hidden flag of the object
  - *Object*: The object to set the hidden flag
  - *Hidden*: The hidden flag value

- **Obj add flag**: Add a flag to the object
  - *Object*: The object to add the flag
  - *Flag*: The flag to add

- **Obj clear flag**: Clear a flag from the object
  - *Object*: The object to clear the flag
  - *Flag*: The flag to clear

- **Obj has flag**: Check if the object has the specified flag
  - *Object*: The object to check the flag
  - *Flag*: The flag to check
  - *Store result into*: The variable to store the result

- **Obj set state checked**: Set the checked state of the object
  - *Object*: The object to set the checked state
  - *Checked*: The checked state to set

- **Obj set state disabled**: Set the disabled state of the object
  - *Object*: The object to set the disabled state
  - *Disabled*: The disabled state to set

- **Obj add state**: Add a state to the object
  - *Object*: The object to add the state
  - *State*: The state to add

- **Obj clear state**: Clear a state from the object
  - *Object*: The object to clear the state
  - *State*: The state to clear

- **Obj has state**: Check if the object has the specified state
  - *Object*: The object to check the state
  - *State*: The state to check
  - *Store result into*: The variable to store the result

- **Arc set value**: Set the value of the arc
  - *Object*: The arc to set the value
  - *Value*: The value to set

- **Bar set value**: Set the value of the bar
  - *Object*: The bar to set the value
  - *Value*: The value to set (0-100)
  - *Animated*: Use animation when setting the value

- **Dropdown set selected**: Set the selected item of the dropdown
  - *Object*: The dropdown to set the selected item
  - *Selected*: The index of the selected item

- **Image set src**: Set the source image of the image
  - *Object*: The image to set the source
  - *Src*: The source image to set given as a string

- **Image set angle**: Set the angle of the image
  - *Object*: The image to set the angle
  - *Angle*: The angle to set. Angle has 0.1 degree precision, so for 45.8° set 458.

- **Image set zoom**: Set the zoom of the image
  - *Object*: The image to set the zoom
  - *Zoom*: The zoom to set. Set factor to 256 to disable zooming. A larger value enlarges the images (e.g. 512 double size), a smaller value shrinks it (e.g. 128 half size).

- **Label set text**: Set the text of the label
  - *Object*: The label to set the text
  - *Text*: The text to set

- **Roller set selected**: Set the selected item of the roller
  - *Object*: The roller to set the selected item
  - *Selected*: The index of the selected item
  - *Animated*: Use animation when setting the selected item

- **Slider set value**: Set the value of the slider
  - *Object*: The slider to set the value
  - *Value*: The value to set
  - *Animated*: Use animation when setting the value

- **Keyboard set textarea**: Set the textarea for the keyboard
  - *Object*: The keyboard to set the textarea
  - *Textarea*: The textarea to set

- **Group focus obj**: Focus the object
  - *Object*: The object to focus

- **Group focus next**: Focus the next object in the group
  - *Group*: The group to focus the next object

- **Group focus prev**: Focus the previous object in the group
  - *Group*: The group to focus the previous object

- **Group get focused**: Get the focused object in the group
  - *Group*: The group to get the focused object
  - *Store result into*: The variable to store the focused object

- **Group focus freeze**: Do not let to change the focus from the current object
  - *Group*: The group to freeze/unfreeze the focus
  - *Enabled*: true: freeze, false: release freezing (normal mode)

- **Group set wrap**: Set whether focus next/prev will allow wrapping from first->last or last->first object.
  - *Group*: The group to set the wrap
  - *Enabled*: true: wrap, false: no wrap

- **Group set editing**: Manually set the current mode (edit or navigate).
  - *Group*: The group to set the editing mode
  - *Enabled*: true: edit mode, false: navigate mode

- **Anim x**: Animate the x coordinate of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim y**: Animate the y coordinate of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim width**: Animate the width of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim height**: Animate the height of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim opacity**: Animate the opacity of the object
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim image zoom**: Animate the zoom of the image
  - *Object*: The object to animate
  - *Start*: The start value of the animation
  - *End*: The end value of the animation
  - *Delay*: Delay in milliseconds before the animation starts
  - *Time*: Animation duration in milliseconds
  - *Relative*: Determines whether `Start` and `End` values are relative to the current value or are absolute values.
  - *Instant*: If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts
  - *Path*: The animation path

- **Anim image angle**: Animate the angle of the image
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
