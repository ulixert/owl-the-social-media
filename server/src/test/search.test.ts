import { describe, expect, it } from 'vitest';

import {
  postSearchEffect,
  toPostDoc,
  toUserDoc,
  userSearchEffect,
} from '../features/search/search.js';

describe('postSearchEffect (CDC mapping)', () => {
  const post = { id: 7, postedById: 3, text: 'hello world', isDeleted: false };

  it('maps create, snapshot-read, and edit of a live post to index', () => {
    const doc = { op: 'index', id: 7, doc: { text: 'hello world', postedById: 3 } };
    expect(postSearchEffect({ op: 'c', after: post })).toEqual(doc);
    expect(postSearchEffect({ op: 'r', after: post })).toEqual(doc);
    // An edit re-indexes with the new text.
    expect(postSearchEffect({ op: 'u', after: { ...post, text: 'edited' } })).toEqual({
      op: 'index',
      id: 7,
      doc: { text: 'edited', postedById: 3 },
    });
  });

  it('maps a soft delete (update flipping isDeleted) to delete', () => {
    expect(postSearchEffect({ op: 'u', after: { ...post, isDeleted: true } })).toEqual({
      op: 'delete',
      id: 7,
    });
  });

  it('maps a hard delete to delete using the before image', () => {
    expect(postSearchEffect({ op: 'd', before: post })).toEqual({ op: 'delete', id: 7 });
  });

  it('ignores malformed events and rows missing id/text', () => {
    expect(postSearchEffect(null)).toBeNull();
    expect(postSearchEffect({})).toBeNull();
    expect(postSearchEffect({ op: 'c', after: { id: 7, postedById: 3 } })).toBeNull(); // no text
    expect(postSearchEffect({ op: 'd', before: {} })).toBeNull(); // no id
  });
});

describe('userSearchEffect (CDC mapping)', () => {
  const user = { id: 4, username: 'alice', name: 'Alice A' };

  it('maps create/read/update to index', () => {
    const doc = { op: 'index', id: 4, doc: { username: 'alice', name: 'Alice A' } };
    expect(userSearchEffect({ op: 'c', after: user })).toEqual(doc);
    expect(userSearchEffect({ op: 'r', after: user })).toEqual(doc);
    expect(userSearchEffect({ op: 'u', after: user })).toEqual(doc);
  });

  it('normalizes a null name', () => {
    expect(userSearchEffect({ op: 'c', after: { id: 4, username: 'alice', name: null } })).toEqual(
      { op: 'index', id: 4, doc: { username: 'alice', name: null } },
    );
  });

  it('maps a delete to delete using the before image', () => {
    expect(userSearchEffect({ op: 'd', before: user })).toEqual({ op: 'delete', id: 4 });
  });

  it('ignores malformed events and rows missing id/username', () => {
    expect(userSearchEffect(null)).toBeNull();
    expect(userSearchEffect({ op: 'c', after: { id: 4 } })).toBeNull(); // no username
    expect(userSearchEffect({ op: 'd', before: {} })).toBeNull(); // no id
  });
});

describe('document builders', () => {
  it('toPostDoc keeps only the searchable fields', () => {
    expect(toPostDoc({ id: 1, text: 'hi', postedById: 2, isDeleted: false } as never)).toEqual({
      text: 'hi',
      postedById: 2,
    });
  });

  it('toUserDoc coalesces a missing name to null', () => {
    expect(toUserDoc({ username: 'bob', name: undefined } as never)).toEqual({
      username: 'bob',
      name: null,
    });
  });
});
