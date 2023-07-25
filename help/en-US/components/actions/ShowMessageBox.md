# DESCRIPTION [DRAFT]

Ova akcija prikazuje na ekranu info, error ili question message box.

# PROPERTIES

## Message type [DRAFT]

Postoje tri vrste message boxa:

-   Info

![Alt text](../images/show_message_box_info.png)

-   Error

![Alt text](../images/show_message_box_error.png)

-   Question

![Alt text](../images/show_message_box_question.png)

## Message [DRAFT]

Poruka koja se prikazuje.

## Buttons [DRAFT]

Ovaj property je potrebno definirati samo za Question message box. Ovdje se očekuje array stringova, gdje se svaki string mapira u button, npr. `["Save", "Don't Save", "Cancel"]`. Za svaki button potrebno je dodati po jedan output u "Flow - Outputs" sekciju, gdje će se kroz njega izaći ako se pritisne taj button.

# INPUTS

## seqin [DRAFT]

A standard sequence input.

# OUTPUTS

## seqout [DRAFT]

A standard sequence output.

# EXAMPLES [DRAFT]

-   Keyboard, Keypad and Message Box
