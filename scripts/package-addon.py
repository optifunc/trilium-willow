#!/usr/bin/env python3
"""Build Trilium's native format-v2 subtree ZIP, without a running Trilium."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile
from build_version import validate_version

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
base_version = json.loads((ROOT / 'package.json').read_text())['version']
version = validate_version(os.environ.get('WILLOW_VERSION', base_version))
licenses = ('Willow\n\n' + (ROOT / 'LICENSE').read_text()
            + '\nMind-map widget (mr)\n\n' + (ROOT / 'mr' / 'LICENSE').read_text())
notices = (licenses + '\nTrilium and Preact are supplied by the host, not bundled in this archive.\n'
           'Their licenses remain separate. See https://github.com/optifunc/trilium-willow/blob/main/docs/licensing.md\n').encode()
bundle = b'/*!\n' + notices + b'*/\n' + (DIST / 'willow-spike.js').read_bytes()
instructions = (ROOT / 'docs' / 'installation.html').read_bytes()


def attribute(kind, name, value='', inherit=False):
    return dict(type=kind, name=name, value=value, isInheritable=inherit)


def note(id, title, filename, kind, mime, attributes=None):
    return dict(noteId=id, title=title, dataFileName=filename, type=kind, mime=mime,
                isClone=False, isExpanded=True, attributes=attributes or [], attachments=[])


editor = note('willowEditor', 'Willow shared editor', 'editor.jsx', 'code', 'text/jsx',
              [attribute('label', 'willowVersion', version)])
template = note('willowTemplate', 'Willow Mind Map', 'template.json', 'render', 'application/json', [
    attribute('label', 'template'), attribute('label', 'willowMindMap', inherit=True),
    attribute('label', 'iconClass', 'bx bx-git-branch', True),
    attribute('relation', 'renderNote', 'willowEditor', True)])
example = note('willowExample', 'Example mind map', 'example.json', 'render', 'application/json', [
    attribute('label', 'willowMindMap'), attribute('relation', 'renderNote', 'willowEditor')])
folder = note('willowAddon', 'Willow Mind Map add-on', 'Willow.html', 'text', 'text/html',
              [attribute('label', 'willowAddon', version)])
license_note = note('willowLicenses', 'Licensing and notices', 'licenses.txt', 'code', 'text/plain')
folder.update(dirFileName='Willow', children=[editor, template, example, license_note])


def document(root, **extra):
    return json.dumps(dict(format='trilium-willow-mindmap', version=1,
                           document=dict(root=root), **extra)).encode()


entries = {
    '!!!meta.json': json.dumps(dict(formatVersion=2, appVersion='0.105.0', files=[folder]), indent=2).encode(),
    'Willow.html': instructions,
    'Willow/editor.jsx': bundle,
    'Willow/licenses.txt': notices,
    'Willow/template.json': document(dict(id='willow-template-root', text='Mind map', children=[]), initializeFromTitle=True),
    'Willow/example.json': document(dict(id='example-root', text='Willow', children=[
        dict(id='example-ideas', text='Ideas', side='left', children=[]),
        dict(id='example-start', text='Select a node, then F2 to edit', side='right', children=[]),
        dict(id='example-child', text='Tab adds a child', side='right', children=[])])),
}
archive = DIST / f'trilium-willow-{version}.zip'
with zipfile.ZipFile(archive, 'w') as out:
    for name, data in entries.items():
        info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        out.writestr(info, data)
(DIST / 'willow-editor.jsx').write_bytes(bundle)
(DIST / 'installation.html').write_bytes(instructions)


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


source = dict(commit=git('rev-parse', 'HEAD'), mrCommit=git('-C', 'mr', 'rev-parse', 'HEAD'),
              dirty=bool(git('status', '--porcelain')))
workflow = None
if os.environ.get('GITHUB_ACTIONS') == 'true':
    workflow = dict(name=os.environ['GITHUB_WORKFLOW'], repository=os.environ['GITHUB_REPOSITORY'],
                    runId=os.environ['GITHUB_RUN_ID'], runNumber=os.environ['GITHUB_RUN_NUMBER'],
                    attempt=os.environ['GITHUB_RUN_ATTEMPT'],
                    url=f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/attempts/{os.environ['GITHUB_RUN_ATTEMPT']}")
manifest = dict(version=version, baseVersion=base_version, source=source, workflow=workflow, license='MIT',
                trilium='0.105.0', documentVersion=1,
                files={p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                       for p in [archive, DIST / 'willow-editor.jsx', DIST / 'installation.html']})
(DIST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{archive.relative_to(ROOT)} ({archive.stat().st_size:,} bytes)')
