import { expect, it, vi } from 'vitest';
import { UIVisibility, uiHiddenLabel } from '../src/ui-visibility';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const rootChange = () => ({ getAttributeRows: () => [{ noteId: 'root', type: 'label', name: uiHiddenLabel, value: 'true' }] });

it('loads once for simultaneous panes and applies a choice to every subscriber only after saving', async () => {
  const read = vi.fn(async () => true), saved = deferred<void>();
  const store = new UIVisibility(read, () => saved.promise);
  const first = vi.fn(), second = vi.fn(), report = vi.fn();
  store.subscribe(first, report); store.subscribe(second, report);
  await store.refresh();
  expect(read).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenLastCalledWith(true);
  expect(second).toHaveBeenLastCalledWith(true);
  const change = store.set(false);
  await Promise.resolve();
  expect(first).toHaveBeenLastCalledWith(true);
  saved.resolve(); await change;
  expect(first).toHaveBeenLastCalledWith(false);
  expect(second).toHaveBeenLastCalledWith(false);
  expect(report).toHaveBeenLastCalledWith('');
});

it('retains the confirmed setting on write failure and allows retry', async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const store = new UIVisibility(async () => false, write), update = vi.fn();
  store.subscribe(update, vi.fn()); await store.refresh();
  await expect(store.set(true)).rejects.toThrow('offline');
  expect(update).toHaveBeenLastCalledWith(false);
  await store.set(true);
  expect(update).toHaveBeenLastCalledWith(true);
});

it('serializes rapid choices behind initial loading without stale reads overwriting them', async () => {
  const initial = deferred<boolean>(), firstWrite = deferred<void>();
  const write = vi.fn().mockImplementationOnce(() => firstWrite.promise).mockResolvedValue(undefined);
  const store = new UIVisibility(() => initial.promise, write), update = vi.fn();
  store.subscribe(update, vi.fn());
  const hide = store.set(true), show = store.set(false);
  expect(write).not.toHaveBeenCalled();
  initial.resolve(false);
  await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  expect(write).toHaveBeenLastCalledWith(true);
  firstWrite.resolve(); await hide; await show;
  expect(write.mock.calls).toEqual([[true], [false]]);
  expect(update).toHaveBeenLastCalledWith(false);
});

it('rereads a snapshot invalidated by a root event, and deduplicates the event across panes', async () => {
  const initial = deferred<boolean>();
  const read = vi.fn().mockImplementationOnce(() => initial.promise).mockResolvedValue(true);
  const store = new UIVisibility(read, vi.fn()), update = vi.fn();
  store.subscribe(update, vi.fn()); await Promise.resolve();
  const event = rootChange(); store.reload(event); store.reload(event);
  initial.resolve(false); await store.refresh();
  expect(read).toHaveBeenCalledTimes(2);
  expect(update.mock.calls).toEqual([[false], [true]]);
  store.reload({ getAttributeRows: () => [{ ...event.getAttributeRows()[0]!, noteId: 'another-map' }] });
  await Promise.resolve(); expect(read).toHaveBeenCalledTimes(2);
});

it('refreshes after all panes were closed and stops notifying disposed panes', async () => {
  let saved = true;
  const store = new UIVisibility(async () => saved, vi.fn()), previous = vi.fn(), next = vi.fn();
  const unsubscribe = store.subscribe(previous, vi.fn()); await store.refresh();
  unsubscribe(); previous.mockClear(); saved = false;
  store.subscribe(next, vi.fn()); await store.refresh();
  expect(next).toHaveBeenLastCalledWith(false);
  expect(previous).not.toHaveBeenCalled();
});

it('reports load failure and recovers on a later attribute event', async () => {
  const read = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(true);
  const store = new UIVisibility(read, vi.fn()), report = vi.fn(), update = vi.fn();
  store.subscribe(update, report);
  await expect(store.refresh()).rejects.toThrow('offline');
  expect(report).toHaveBeenCalledTimes(1);
  store.reload(rootChange()); await store.refresh();
  expect(update).toHaveBeenLastCalledWith(true);
  expect(report).toHaveBeenLastCalledWith('');
});
