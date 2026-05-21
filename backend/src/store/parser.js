// Parses todos.md into an in-memory representation.
//
// The file is parsed line-by-line. Two kinds of lines:
//   - task lines:    `- [ ] title <!-- key:val key:val ... -->`
//                    `- [x] title <!-- ... -->`
//   - passthrough:   everything else (headings, blanks, free text)
//
// We keep passthrough lines verbatim so a round-trip (parse → serialize)
// never destroys content a human added.

const TASK_RE = /^- \[( |x)\] (.+?)(?:\s+<!--\s*(.*?)\s*-->)?\s*$/;

// Parse a `key:"quoted value"` or `key:value` metadata blob.
function parseMeta(raw) {
  const out = {};
  if (!raw) return out;
  // Match key:"..."  OR  key:nonspace
  const re = /(\w+):(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return out;
}

export function parse(text) {
  const lines = text.split(/\r?\n/);
  const items = []; // ordered list of { kind: 'task' | 'raw', ... }

  for (const line of lines) {
    const match = line.match(TASK_RE);
    if (match) {
      const [, doneMark, title, metaRaw] = match;
      const meta = parseMeta(metaRaw);
      items.push({
        kind: 'task',
        done: doneMark === 'x',
        title: title.trim(),
        id: meta.id, // may be undefined; store layer fills it in
        priority: meta.priority ? Number(meta.priority) : undefined,
        created: meta.created,
        completed: meta.completed,
        description: meta.description,
      });
    } else {
      items.push({ kind: 'raw', text: line });
    }
  }

  // Drop the trailing empty line caused by a trailing newline in the file,
  // so that serialize() can re-add exactly one trailing newline.
  if (items.length && items[items.length - 1].kind === 'raw' && items[items.length - 1].text === '') {
    items.pop();
  }

  return items;
}

// Convenience: just the tasks, in file order.
export function tasksOnly(items) {
  return items.filter((i) => i.kind === 'task');
}
