NAME = Readest
# Keep the full app release version in the archive filename (for example
# 0.12.8-fork.1), while sync_version.py writes only the numeric SemVer core
# into calibre's three-integer PLUGIN_VERSION tuple.
VERSION = $(shell python3 -c "from sync_version import app_version_string; print(app_version_string())")
ZIP = dist/$(NAME)-$(VERSION).calibre-plugin.zip

FILES = __init__.py api.py config.py dialogs.py oauth.py ui.py wire.py worker.py \
	plugin-import-name-readest.txt images/icon.png

.PHONY: zip version test install clean

zip: $(ZIP)

# Writes only when the version has drifted, so it never forces a rebuild.
version:
	@python3 sync_version.py

$(ZIP): $(FILES) | version
	mkdir -p dist
	rm -f $(ZIP)
	zip -q $(ZIP) $(FILES)
	@echo Built $(ZIP)

test:
	python3 -m unittest discover -s tests

# Load the plugin into a locally installed calibre for development.
install: zip
	calibre-customize -a $(ZIP)

clean:
	rm -rf dist
