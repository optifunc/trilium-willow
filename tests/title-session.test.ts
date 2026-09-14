import { describe, expect, it, vi } from 'vitest';
import { TitleSession } from '../src/title-session';
import { parseDocument, serializeDocument } from '../src/document';

const map = (text: string) => serializeDocument({ root: { id: 'root', text, children: [{ id: 'child', text: 'Child', side: 'right', children: [] }] } });
const root = (s: TitleSession) => parseDocument(s.local!).root.text;
function fixture(title = 'Original', text = title) {
  let content = map(text), remoteTitle = title;
  const write = vi.fn(async (value: string) => { content = value; });
  const writeTitle = vi.fn(async (value: string) => { remoteTitle = value; });
  const session = new TitleSession('note', title, async () => content, write, async () => remoteTitle, writeTitle);
  session.writable = true; session.receive(content); session.validate(); session.cancelTimer();
  return { session, write, writeTitle, remoteTitle: (value: string) => { remoteTitle = value; }, content: () => content };
}
describe('shared title and root synchronization', () => {
  it('does not mistake the first template load for a remote root edit while its title has focus', async () => {
    const writeTitle=vi.fn(async()=>{});let content=map('Mind map');
    const session=new TitleSession('note','New note',async()=>content,async value=>{content=value;},async()=>'Typed title',writeTitle);
    session.writable=true;session.editTitle(true);
    session.subscribe(()=>session.validate());session.receive(content);
    expect(session.dirty).toBe(false);await session.flush();expect(writeTitle).not.toHaveBeenCalled();
    session.editTitle(false,'Typed title');await session.flush();expect(root(session)).toBe('Typed title');expect(writeTitle).not.toHaveBeenCalled();
  });
  it('does not rename from malformed content replacing a previously valid map', async () => {
    const {session,writeTitle}=fixture();
    const malformed=JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'root',text:42,children:[]}}});
    session.receive(malformed);await session.flush();expect(writeTitle).not.toHaveBeenCalled();
    session.invalidate();session.receiveTitle('External title');expect(session.local).toBe(malformed);
  });
  it('does not treat focusing an unchanged title as a competing rename', async () => {
    const {session,writeTitle}=fixture();session.change(map('Root draft'));
    session.editTitle(true);session.editTitle(false,'Original');await session.flush();
    expect(session.state).toBe('saved');expect(writeTitle).toHaveBeenCalledWith('Root draft');
  });
  it('uses the chosen incoming root after content recovery and synchronizes its title', async () => {
    let content=map('Original');const writeTitle=vi.fn(async()=>{});
    const session=new TitleSession('note','Original',async()=>content,async value=>{content=value;},async()=>'Original',writeTitle);
    session.writable=true;session.receive(content);session.validate();session.change(map('Local root'));session.cancelTimer();
    content=map('Incoming root');session.receive(content);await session.useIncoming();await session.flush();
    expect(root(session)).toBe('Incoming root');expect(writeTitle).toHaveBeenCalledWith('Incoming root');
  });
  it('defers initial alignment saves during native title typing and applies the finished value', async () => {
    const {session,write,remoteTitle}=fixture('Template title','Old root');
    session.editTitle(true);session.receiveTitle('Partial');
    expect(root(session)).toBe('Template title');expect(write).not.toHaveBeenCalled();
    remoteTitle('Completed title');session.editTitle(false,'Completed title');
    expect(session.state).toBe('unsaved');await session.flush();expect(root(session)).toBe('Completed title');
  });
  it('preserves a pending title retry when recovery is cancelled', async () => {
    const {session,writeTitle}=fixture();writeTitle.mockRejectedValueOnce(Error('offline'));
    session.change(map('Draft'));await expect(session.flush()).rejects.toThrow();
    await session.useIncoming(undefined,async()=>false);
    expect(session.dirty).toBe(true);await session.flush();expect(writeTitle).toHaveBeenLastCalledWith('Draft');
  });
  it('retains the draft if a title changes during the final recovery read', async () => {
    let release!:(content:string)=>void;
    const session=new TitleSession('note','Title',()=>new Promise(resolve=>{release=resolve;}),async()=>{},async()=>'Title',async()=>{});
    session.writable=true;session.receive(map('Title'));session.validate();session.change(map('Draft'));session.cancelTimer();
    const recovery=session.useIncoming();await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
    session.receiveTitle('External title');release(map('Server root'));
    await expect(recovery).rejects.toThrow('changed during recovery');expect(root(session)).toBe('Draft');
  });
  it('aligns a validated existing map to its title once, preserving children', async () => {
    const {session,writeTitle}=fixture('Trilium title','Old root');
    expect(root(session)).toBe('Trilium title');
    await session.flush();expect(writeTitle).not.toHaveBeenCalled();
    expect(parseDocument(session.local!).root.children[0]?.text).toBe('Child');
    session.change(map('Root edit'));await session.flush();session.validate();
    expect(root(session)).toBe('Root edit');expect(writeTitle).toHaveBeenCalledWith('Root edit');
  });
  it('updates the title for root edit/undo and retries after content saved but title failed', async () => {
    const {session,write,writeTitle}=fixture();
    writeTitle.mockRejectedValueOnce(new Error('Title offline'));
    session.change(map('New root'));await expect(session.flush()).rejects.toThrow('Title offline');
    expect(session.state).toBe('error');expect(session.dirty).toBe(true);
    await session.flush();expect(write).toHaveBeenCalledTimes(1);expect(writeTitle).toHaveBeenCalledTimes(2);
    session.change(map('Original'));await session.flush();expect(writeTitle).toHaveBeenLastCalledWith('Original');
  });
  it('does not rename the note for child-only changes', async () => {
    const {session,writeTitle}=fixture();const document=parseDocument(session.local!);
    document.root.children[0]!.text='Changed child';session.change(serializeDocument(document));await session.flush();
    expect(writeTitle).not.toHaveBeenCalled();
  });
  it('accepts saved title edits without a title-write feedback loop', async () => {
    const {session,writeTitle,remoteTitle}=fixture();remoteTitle('New title');session.receiveTitle('New title');
    expect(root(session)).toBe('New title');await session.flush();session.receiveTitle('New title');
    expect(session.state).toBe('saved');expect(writeTitle).not.toHaveBeenCalled();
  });
  it('retains an unfinished edit when an external title arrives', () => {
    const {session}=fixture();session.editing=true;session.receiveTitle('External title');
    expect(root(session)).toBe('Original');expect(session.state).toBe('conflict');
    expect(parseDocument(session.incoming!).root.text).toBe('External title');
  });
  it('refuses to overwrite an unseen concurrent title after a map write', async () => {
    const {session,remoteTitle,writeTitle}=fixture();session.change(map('Local root'));remoteTitle('Remote title');
    await expect(session.flush()).rejects.toThrow('title changed');
    expect(root(session)).toBe('Local root');expect(session.state).toBe('conflict');expect(writeTitle).not.toHaveBeenCalled();
    await session.useIncoming();await session.flush();expect(root(session)).toBe('Remote title');
  });
  it('does not align invalid or read-only maps until writable validation', async () => {
    const session=new TitleSession('note','Title',async()=>map('Root'),async()=>{},async()=>'Title',async()=>{});
    session.receive(map('Root'));session.validate();expect(root(session)).toBe('Root');expect(session.dirty).toBe(false);
    session.writable=true;session.align();expect(root(session)).toBe('Title');await session.flush();
    const invalid=new TitleSession('note','Title',async()=>'',async()=>{},async()=>'Title',async()=>{});
    invalid.writable=true;invalid.receive('invalid');invalid.receiveTitle('Changed title');expect(invalid.local).toBe('invalid');
  });
  it('drains a newer root edit during title-write acknowledgement', async () => {
    const {session,writeTitle,remoteTitle}=fixture();let release!:()=>void;
    writeTitle.mockImplementationOnce(async title=>{await new Promise<void>(resolve=>{release=resolve;});remoteTitle(title);session.receiveTitle(title);});
    session.change(map('One'));const pending=session.flush();await vi.waitFor(()=>expect(writeTitle).toHaveBeenCalled());
    session.change(map('Two'));release();await pending;expect(root(session)).toBe('Two');expect(writeTitle).toHaveBeenLastCalledWith('Two');
    expect(session.state).toBe('saved');
  });
});
