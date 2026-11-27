# 11 — Keyboard workflow

Buoy supports keyboard navigation alongside mouse and touch. Shortcuts are
ignored while editing text, using modifier keys, or composing text with an IME.

## Main view

| Key | Action |
| --- | --- |
| `a` | Open Add todo |
| `f`, then a bubble's letter | Open a visible todo's details |
| `h` / `l` | Move to the previous / next section |
| `g`, then `1`–`9` | Jump to the corresponding numbered section |
| `d`, then a bubble's letter | Choose a todo to delete; confirm with `d` or cancel with `Esc` |
| `Esc` | Cancel a pending section jump or picker |

The picker labels the first 26 visible todos. Numbered section markers indicate
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
| `Enter` | Submit the todo |

The current mode and preview are shown in the dialog. In insert mode, Enter
also submits the todo, including from Description. Tab and Shift+Tab remain available
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
