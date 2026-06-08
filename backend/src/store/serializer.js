// Turns the parsed item list back into Markdown text.
//
// The shape of `items` is identical to what parse() returns. Task items
// become `- [ ] title <!-- ... -->` lines; raw items pass through.

const META_KEYS = ['id', 'priority', 'created', 'completed', 'description'];

function renderMeta(task) {
  const parts = [];
  for (const key of META_KEYS) {
    const val = task[key];
    if (val === undefined || val === null || val === '') continue;
    const needsQuotes = typeof val === 'string' && /\s|"/.test(val);
    const safe = needsQuotes ? `"${String(val).replace(/"/g, '\\"')}"` : String(val);
    parts.push(`${key}:${safe}`);
  }
  return parts.length ? ` <!-- ${parts.join(' ')} -->` : '';
}

function renderTask(task) {
  const mark = task.done ? 'x' : ' ';
  return `- [${mark}] ${task.title}${renderMeta(task)}`;
}

export function serialize(items) {
  const out = items.map((item) => {
    if (item.kind === 'task') return renderTask(item);
    if (item.kind === 'heading') return `# ${item.text}`;
    return item.text;
  });
  // Always end with exactly one trailing newline.
  return out.join('\n') + '\n';
}
