import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveSession } from '../src/save-session';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function fixture() {
  let remote = 'base';
  const read = vi.fn(async () => remote);
  const write = vi.fn(async (value: string) => { remote = value; });
  const session = new SaveSession(read, write);
  session.receive(remote); session.writable = true;
  return { session, read, write, remote: (value: string) => { remote = value; } };
}
afterEach(() => vi.useRealTimers());
describe('document save coordination', () => {
  it('serializes writes and drains edits made during an in-flight save', async () => {
    const { session, write, remote } = fixture();
    const first = deferred<void>();
    write.mockImplementationOnce(async value => { await first.promise; remote(value); });
    session.change('one'); const saved = session.flush();
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    session.change('two');
    session.receive('one'); // own echo while a newer local edit exists
    expect(session.local).toBe('two'); expect(session.incoming).toBeUndefined();
    first.resolve(); await saved;
    expect(write.mock.calls).toEqual([['one'], ['two']]);
    expect(session.base).toBe('two'); expect(session.state).toBe('saved');
    session.cancelTimer();
  });
  it('retains a failed draft and retries with the latest local content', async () => {
    const { session, write } = fixture();
    write.mockRejectedValueOnce(new Error('offline'));
    session.change('one'); await expect(session.flush()).rejects.toThrow('offline');
    expect(session.base).toBe('base'); expect(session.local).toBe('one'); expect(session.state).toBe('error');
    session.change('two'); await session.flush();
    expect(session.base).toBe('two'); expect(session.state).toBe('saved');
  });
  it('detects a changed base before writing and pauses until explicit resolution', async () => {
    const { session, write, remote } = fixture();
    session.change('local'); remote('incoming');
    await expect(session.flush()).rejects.toThrow('external change');
    expect(write).not.toHaveBeenCalled(); expect(session.local).toBe('local');
    expect(session.incoming).toBe('incoming');
    session.change('more local');
    await expect(session.flush()).rejects.toThrow();
    await session.useIncoming(); expect(session.local).toBe('incoming'); expect(session.state).toBe('saved');
  });
  it('does not clear an incoming conflict when an older write succeeds', async () => {
    const { session, write } = fixture(); const first = deferred<void>();
    write.mockImplementationOnce(() => first.promise);
    session.change('local'); const saved = session.flush();
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    session.receive('incoming'); session.change('later local'); first.resolve();
    await expect(saved).rejects.toThrow();
    expect(session.state).toBe('conflict'); expect(session.local).toBe('later local');
    expect(session.incoming).toBe('incoming'); expect(write).toHaveBeenCalledOnce();
  });
  it('treats an unfinished label as dirty and preserves a failed recovery read', async () => {
    const { session, read } = fixture();
    session.editing = true; session.receive('incoming');
    expect(session.local).toBe('base'); expect(session.state).toBe('conflict');
    read.mockRejectedValueOnce(new Error('offline'));
    await expect(session.useIncoming()).rejects.toThrow('offline');
    expect(session.local).toBe('base'); expect(session.incoming).toBe('incoming');
  });
  it('checks read-only again after a delayed preflight', async () => {
    const { session, read, write } = fixture(); const first = deferred<string>();
    read.mockReturnValueOnce(first.promise);
    session.change('local'); const saved = session.flush();
    session.writable = false; first.resolve('base');
    await expect(saved).rejects.toThrow('read-only'); expect(write).not.toHaveBeenCalled();
  });
  it('does not resend a write whose response was lost but content was stored', async () => {
    const { session, write, remote } = fixture();
    write.mockImplementationOnce(async content => { remote(content); throw new Error('response lost'); });
    session.change('local'); await expect(session.flush()).rejects.toThrow();
    await session.flush(); expect(write).toHaveBeenCalledOnce(); expect(session.state).toBe('saved');
  });
});
