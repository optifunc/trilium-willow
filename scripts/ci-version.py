#!/usr/bin/env python3
"""Prepare CI's package version; only Publish changes package.json."""
import argparse
import json
import os
from pathlib import Path
import re
from build_version import build_version, validate_version


def prepare(package_path, kind, release, run, attempt):
    original = package_path.read_text(encoding='utf-8')
    current = validate_version(json.loads(original)['version'], base=True)
    base = validate_version(release, base=True) if kind == 'publish' else current
    if tuple(map(int, base.split('.'))) < tuple(map(int, current.split('.'))):
        raise ValueError('Release version cannot be lower than package.json')
    version = build_version(base, kind, run, attempt)
    if kind == 'publish' and current != base:
        updated = re.sub(r'("version"\s*:\s*")[^"]+(")',
                         lambda match: match[1] + base + match[2], original, count=1)
        package_path.write_text(updated, encoding='utf-8')
    return {'WILLOW_VERSION': version, 'WILLOW_BASE_VERSION': base, 'WILLOW_TAG': f'v{base}'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=['build', 'publish'])
    args = parser.parse_args()
    values = prepare(Path(__file__).resolve().parent.parent / 'package.json', args.kind,
                     os.environ.get('RELEASE_VERSION', ''), os.environ['GITHUB_RUN_NUMBER'],
                     os.environ['GITHUB_RUN_ATTEMPT'])
    with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as env:
        for key, value in values.items():
            env.write(f'{key}={value}\n')
    print(json.dumps(values))
