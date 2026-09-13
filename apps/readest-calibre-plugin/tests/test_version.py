import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sync_version import app_version, app_version_string, plugin_version, sync  # noqa: E402


class PluginVersionTest(unittest.TestCase):
    def test_committed_version_matches_the_app(self):
        # The zip ships PLUGIN_VERSION as a literal, so a stale value means
        # every local build installs into calibre under the wrong version.
        # release.yml stamps releases from this same package.json.
        self.assertEqual(plugin_version(), app_version())

    def test_app_version_is_a_three_part_tuple(self):
        version = app_version()
        self.assertEqual(len(version), 3)
        self.assertTrue(all(isinstance(part, int) for part in version))

    def test_fork_prerelease_keeps_release_string_and_numeric_calibre_core(self):
        fd, path = tempfile.mkstemp(suffix='.json')
        os.close(fd)
        self.addCleanup(os.unlink, path)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'version': '0.12.8-fork.1'}, f)
        self.assertEqual(app_version_string(path), '0.12.8-fork.1')
        self.assertEqual(app_version(path), (0, 12, 8))


class SyncTest(unittest.TestCase):
    def write(self, body):
        fd, path = tempfile.mkstemp(suffix='.py')
        os.close(fd)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(body)
        self.addCleanup(os.unlink, path)
        return path

    def test_rewrites_a_stale_version(self):
        path = self.write("NAME = 'x'\nPLUGIN_VERSION = (0, 1, 0)\nOTHER = 1\n")
        self.assertTrue(sync(path, (0, 11, 20)))
        self.assertEqual(plugin_version(path), (0, 11, 20))

    def test_is_idempotent(self):
        path = self.write('PLUGIN_VERSION = (0, 11, 20)\n')
        self.assertFalse(sync(path, (0, 11, 20)))

    def test_leaves_the_rest_of_the_file_alone(self):
        path = self.write(
            "HEAD = 1\nPLUGIN_VERSION = (0, 1, 0)\nTAIL = 'PLUGIN_VERSION = (9, 9, 9)'\n"
        )
        sync(path, (1, 2, 3))
        with open(path, encoding='utf-8') as f:
            body = f.read()
        self.assertIn('HEAD = 1', body)
        self.assertIn("TAIL = 'PLUGIN_VERSION = (9, 9, 9)'", body)
        self.assertIn('PLUGIN_VERSION = (1, 2, 3)', body)


if __name__ == '__main__':
    unittest.main()
