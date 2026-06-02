import { describe, it, expect } from 'vitest';
import { parse, tasksOnly } from '../src/store/parser.js';
import { serialize } from '../src/store/serializer.js';

describe('parser', () => {
  it('parses a simple unchecked task', () => {
    const items = parse('- [ ] Buy milk\n');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'task', done: false, title: 'Buy milk' });
  });

  it('parses a checked task', () => {
    const items = parse('- [x] Done thing\n');
    expect(items[0]).toMatchObject({ done: true, title: 'Done thing' });
  });

  it('parses metadata from HTML comment', () => {
    const line = '- [ ] T <!-- id:abc priority:1 created:2026-01-01T00:00:00Z -->\n';
    const [task] = parse(line);
    expect(task).toMatchObject({
      id: 'abc',
      priority: 1,
      created: '2026-01-01T00:00:00Z',
    });
  });

  it('parses quoted description with spaces', () => {
    const line = '- [ ] T <!-- id:a priority:3 description:"hello world" -->\n';
    const [task] = parse(line);
    expect(task.description).toBe('hello world');
  });

  it('preserves non-task lines verbatim', () => {
    const md = '# Title\n\nSome prose.\n- [ ] task\n';
    const items = parse(md);
    expect(items[0]).toEqual({ kind: 'raw', text: '# Title' });
    expect(items[1]).toEqual({ kind: 'raw', text: '' });
    expect(items[2]).toEqual({ kind: 'raw', text: 'Some prose.' });
    expect(items[3].kind).toBe('task');
  });

  it('tasksOnly filters to task items', () => {
    const items = parse('# H\n- [ ] one\n- [x] two\n');
    expect(tasksOnly(items)).toHaveLength(2);
  });
});

describe('round-trip parse → serialize', () => {
  it('preserves headings and prose around tasks', () => {
    const md =
      '# Buoy Todos\n' +
      '\n' +
      '- [ ] Buy milk <!-- id:a1 priority:2 created:2026-05-21T10:00:00Z -->\n' +
      '- [x] Done <!-- id:a2 priority:0 created:2026-05-20T09:00:00Z completed:2026-05-20T18:00:00Z -->\n';
    expect(serialize(parse(md))).toBe(md);
  });

  it('fills in nothing when no metadata present (raw passthrough)', () => {
    // A task without metadata round-trips with no metadata block.
    const md = '- [ ] bare\n';
    expect(serialize(parse(md))).toBe(md);
  });
});
