import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from build_version import build_version, validate_version

spec = importlib.util.spec_from_file_location('ci_version', ROOT / 'scripts/ci-version.py')
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


class Versions(unittest.TestCase):
    def test_unique_dispatches_and_retries(self):
        self.assertEqual(build_version('0.2.0', 'build', '42', '1'), '0.2.0-dev.42.1')
        versions = {build_version('0.2.0', kind, run, attempt)
                    for kind in ('build', 'publish') for run in ('42', '43') for attempt in ('1', '2')}
        self.assertEqual(len(versions), 8)
        for version in versions:
            self.assertEqual(validate_version(version), version)

    def test_reject_invalid_versions_and_counters(self):
        for value in ('v1.2.3', '../bad', '01.2.3', '1.2', '1.2.3\nEVIL=1', '1.2.3-01', '1.2.3+bad/path', '$(whoami)'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_version(value)
        for value in ('0', '-1', '01', '1\nOTHER=1'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                build_version('1.2.3', 'build', value, '1')

    def test_only_publish_updates_base_and_failures_do_not_modify_it(self):
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory) / 'package.json'
            original = '{\n  "name": "test",\n  "version": "0.1.0",\n  "private": true\n}\n'
            package.write_text(original)
            ci.prepare(package, 'build', '', '1', '1')
            self.assertEqual(package.read_text(), original)
            for release, run in (('0.0.1', '1'), ('0.2.0\nINJECT=x', '1'), ('0.2.0', 'bad')):
                with self.assertRaises(ValueError):
                    ci.prepare(package, 'publish', release, run, '1')
                self.assertEqual(package.read_text(), original)
            values = ci.prepare(package, 'publish', '0.2.0', '7', '1')
            self.assertEqual(values['WILLOW_VERSION'], '0.2.0+build.7.1')
            self.assertEqual(package.read_text(), original.replace('0.1.0', '0.2.0'))
            ci.prepare(package, 'publish', '0.2.0', '7', '2')
            self.assertEqual(json.loads(package.read_text())['version'], '0.2.0')


class RepositoryFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = {**os.environ, 'GIT_CONFIG_GLOBAL': os.devnull, 'GIT_CONFIG_NOSYSTEM': '1'}
        self.git(self.root, 'init', '-b', 'main')
        self.git(self.root, 'config', 'user.name', 'Packaging test')
        self.git(self.root, 'config', 'user.email', 'test@example.invalid')
        (self.root / 'package.json').write_text('{"name":"fixture","version":"0.1.0"}\n')
        self.git(self.root, 'add', 'package.json')
        self.git(self.root, 'commit', '-m', 'Initial fixture')

    def git(self, cwd, *args):
        return subprocess.check_output(['git', *args], cwd=cwd, env=self.env, text=True, stderr=subprocess.PIPE).strip()


class Archive(RepositoryFixture):
    def test_version_metadata_checksums_and_repeatability(self):
        for directory in ('scripts', 'docs', 'dist', 'mr'):
            (self.root / directory).mkdir()
        for name in ('package-addon.py', 'build_version.py'):
            shutil.copy(ROOT / 'scripts' / name, self.root / 'scripts' / name)
        shutil.copy(ROOT / 'docs/installation.html', self.root / 'docs/installation.html')
        shutil.copy(ROOT / 'LICENSE', self.root / 'LICENSE')
        shutil.copy(ROOT / 'mr/LICENSE', self.root / 'mr/LICENSE')
        (self.root / '.gitignore').write_text('dist/\n__pycache__/\nmr/\n')
        self.git(self.root / 'mr', 'init', '-b', 'main')
        self.git(self.root / 'mr', 'config', 'user.name', 'Packaging test')
        self.git(self.root / 'mr', 'config', 'user.email', 'test@example.invalid')
        self.git(self.root / 'mr', 'commit', '--allow-empty', '-m', 'Widget fixture')
        self.git(self.root, 'add', '.')
        self.git(self.root, 'commit', '-m', 'Package fixture')
        (self.root / 'dist/willow-spike.js').write_text('export default function Widget() {}\n')
        env = {**self.env, 'WILLOW_VERSION': '0.1.0-dev.42.2', 'GITHUB_ACTIONS': 'true',
               'GITHUB_WORKFLOW': 'Build', 'GITHUB_REPOSITORY': 'owner/repo', 'GITHUB_RUN_ID': '123',
               'GITHUB_RUN_NUMBER': '42', 'GITHUB_RUN_ATTEMPT': '2', 'GITHUB_SERVER_URL': 'https://github.com',
               'GITHUB_SHA': 'deliberately-not-the-built-commit'}

        def package():
            subprocess.run([sys.executable, 'scripts/package-addon.py'], cwd=self.root, env=env, check=True, stdout=subprocess.PIPE)
            return json.loads((self.root / 'dist/manifest.json').read_text())

        first = package()
        self.assertEqual(first, package())
        self.assertEqual(first['source']['commit'], self.git(self.root, 'rev-parse', 'HEAD'))
        self.assertEqual(first['source']['mrCommit'], self.git(self.root / 'mr', 'rev-parse', 'HEAD'))
        self.assertFalse(first['source']['dirty'])
        self.assertEqual(first['license'], 'MIT')
        self.assertEqual(first['workflow']['url'], 'https://github.com/owner/repo/actions/runs/123/attempts/2')
        for filename, digest in first['files'].items():
            self.assertEqual(hashlib.sha256((self.root / 'dist' / filename).read_bytes()).hexdigest(), digest)
        with zipfile.ZipFile(self.root / 'dist/trilium-willow-0.1.0-dev.42.2.zip') as archive:
            folder = json.loads(archive.read('!!!meta.json'))['files'][0]
            self.assertEqual(folder['attributes'][0]['value'], first['version'])
            self.assertEqual(folder['children'][0]['attributes'][0]['value'], first['version'])
            license_note = next(n for n in folder['children'] if n['noteId'] == 'willowLicenses')
            self.assertEqual(license_note['dataFileName'], 'licenses.txt')
            notices = archive.read('Willow/licenses.txt')
            editor = archive.read('Willow/editor.jsx')
            for license_path in [ROOT / 'LICENSE', ROOT / 'mr/LICENSE']:
                self.assertIn(license_path.read_bytes(), notices)
                self.assertIn(license_path.read_bytes(), editor)
            self.assertEqual(editor, (self.root / 'dist/willow-editor.jsx').read_bytes())
            guide = (self.root / 'dist/installation.html').read_bytes()
            self.assertIn((ROOT / 'LICENSE').read_bytes(), guide)
            self.assertEqual(guide, archive.read('Willow.html'))
        env['WILLOW_VERSION'] = '0.1.0-dev.42.3'
        self.assertNotEqual(package()['version'], first['version'])
        self.assertEqual(json.loads((self.root / 'package.json').read_text())['version'], '0.1.0')


class Publication(RepositoryFixture):
    def setUp(self):
        super().setUp()
        self.remote = self.root / 'remote.git'
        self.git(self.root, 'init', '--bare', str(self.remote))
        self.git(self.root, 'remote', 'add', 'origin', str(self.remote))
        self.git(self.root, 'push', '-u', 'origin', 'main')
        self.env.update(WILLOW_TAG='v0.2.0', RELEASE_BRANCH='main', WILLOW_BASE_VERSION='0.2.0', WILLOW_VERSION='0.2.0+build.7.1')

    def step(self, name, success=True):
        result = subprocess.run(['bash', str(ROOT / 'scripts/publish-git.sh'), name], cwd=self.root, env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)

    def prepare(self):
        self.step('check')
        ci.prepare(self.root / 'package.json', 'publish', '0.2.0', '7', '1')
        self.step('commit')

    def test_pushes_exact_version_commit_and_rejects_duplicate_tag(self):
        self.prepare()
        expected = self.git(self.root, 'rev-parse', 'HEAD')
        self.step('push')
        self.assertEqual(self.git(self.remote, 'rev-parse', 'refs/heads/main'), expected)
        self.assertEqual(self.git(self.remote, 'rev-parse', 'refs/tags/v0.2.0^{}'), expected)
        self.step('check', success=False)

    def test_branch_race_cannot_publish_tag_or_overwrite_new_commits(self):
        self.prepare()
        peer = self.root / 'peer'
        self.git(self.root, 'clone', '--branch', 'main', str(self.remote), str(peer))
        self.git(peer, 'config', 'user.name', 'Other contributor')
        self.git(peer, 'config', 'user.email', 'other@example.invalid')
        self.git(peer, 'commit', '--allow-empty', '-m', 'Concurrent change')
        self.git(peer, 'push', 'origin', 'main')
        expected = self.git(peer, 'rev-parse', 'HEAD')
        self.step('check', success=False)
        self.step('push', success=False)
        self.assertEqual(self.git(self.remote, 'rev-parse', 'refs/heads/main'), expected)
        self.assertEqual(self.git(self.remote, 'tag', '--list'), '')
