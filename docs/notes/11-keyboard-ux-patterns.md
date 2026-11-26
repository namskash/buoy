# 11 — Keyboard workflow

Buoy supports keyboard navigation alongside mouse and touch. Shortcuts are
ignored while editing text, using modifier keys, or composing text with an IME.

## Main view

| Key | Action |
| --- | --- |
| `a` | Open Add todo |
| `j` / `k` | Select the next / previous visible todo in list order |
| `Space` / `x` | Toggle the selected todo done / active |
| `Enter` | Open the selected todo's details |
| `h` / `l` | Move to the previous / next section |
| `g`, then `1`–`9` | Jump to the corresponding numbered section |
| `d`, then a bubble's letter | Choose a todo to delete; confirm with `Enter` or `y` |
| `Esc` | Cancel a pending section jump or delete selection, or clear the selected todo |

Selection follows the stable todo list, not the bubbles' constantly changing
positions. A ring marks the selected bubble. Numbered section markers indicate
jump targets; `h` / `l` also reach sections beyond the first nine.

## Add todo

The dialog opens in **insert mode**, focused on Title. Press `Esc` to enter
**normal mode**; press it again to close. Closing keeps the draft.

| Key | Normal-mode action |
| --- | --- |
| `j` / `k` | Preview Title, Priority, or Description without focusing it |
| `i` | Focus the previewed text field and enter insert mode |
| `h` / `l` | Adjust the previewed priority (P0 is most urgent) |
| `0`–`4` | Set the previewed priority directly |

The current mode and preview are shown in the dialog. In insert mode, Enter
submits the todo, including from Description. Tab and Shift+Tab remain available
for ordinary focus navigation; clicking a text field enters insert mode. Draft
line breaks are converted to spaces on submit because the Markdown storage
format keeps each task on one line.

## Todo details

| Key | Action |
| --- | --- |
| `d` | Delete the todo |
| `i` / `a` | Edit the todo |
| `x` | Toggle done / active |
| `Esc` | Close details |

## Priority focus proxy

The visible priority range is paired with a focusable, read-only proxy input.
It provides a keyboard stop for Tab users without allowing digit shortcuts to
leak into text fields. The visible track shows the focus ring; the proxy's
accessible label includes the current priority.
