"""Version validation shared by CI and the distribution packager."""
import re

NUMBER = r'(?:0|[1-9][0-9]*)'
BASE = rf'{NUMBER}\.{NUMBER}\.{NUMBER}'
IDENTIFIER = r'(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
SEMVER = rf'{BASE}(?:-{IDENTIFIER}(?:\.{IDENTIFIER})*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?'


def validate_version(value, *, base=False):
    if not re.fullmatch(BASE if base else SEMVER, value, flags=re.ASCII):
        raise ValueError('Expected MAJOR.MINOR.PATCH' if base else 'Expected a SemVer version')
    return value


def build_version(base, kind, run, attempt):
    validate_version(base, base=True)
    if kind not in ('build', 'publish'):
        raise ValueError('Expected build or publish')
    for value in (run, attempt):
        if not re.fullmatch(r'[1-9][0-9]*', value, flags=re.ASCII):
            raise ValueError('Run number and attempt must be positive integers')
    suffix = '-dev.' if kind == 'build' else '+build.'
    return f'{base}{suffix}{run}.{attempt}'
