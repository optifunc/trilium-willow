import { expect, it, vi } from 'vitest';
import { CreationSession } from '../src/create-session';

it('keeps the request identity and title after failure and view replacement', async () => {
  const create = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce('created');
  const model = new CreationSession(create);
  model.title = 'My map';
  const unsubscribe = model.subscribe(() => {});
  await model.submit('source', 'parent', model.title);
  unsubscribe(); // The host removed the original form.
  const update = vi.fn(); model.subscribe(update);
  const original = model.request;
  await model.submit('source', 'parent', model.title);
  expect(create.mock.calls[1]?.[0]).toBe(original);
  expect(model.created).toBe('created'); expect(model.request).toBeUndefined();
  expect(model.title).toBe('My map'); expect(update).toHaveBeenCalled();
});

it('suppresses a second submission while a creation request is in flight', async () => {
  let resolve!: (id: string) => void;
  const create = vi.fn(() => new Promise<string>(r => { resolve = r; }));
  const model = new CreationSession(create);
  const pending = model.submit('source', 'parent', 'One');
  await model.submit('source', 'parent', 'Two');
  expect(create).toHaveBeenCalledOnce();
  resolve('id'); await pending;
  expect(model.created).toBe('id'); expect(model.busy).toBe(false);
});
