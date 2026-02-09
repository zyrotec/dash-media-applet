UUID := "dash-media-applet@zyrotec"
INSTALL_DIR := env_var('HOME') + "/.local/share/gnome-shell/extensions/" + UUID

build:
    pnpm run build

install: build
    mkdir -p {{INSTALL_DIR}}
    cp -r dist/* {{INSTALL_DIR}}/
    cp src/stylesheet.css {{INSTALL_DIR}}/
    cp metadata.json {{INSTALL_DIR}}/

debug:
    SHELL_DEBUG=a11 dbus-run-session gnome-shell --devkit --wayland --no-x11

dev: install debug

clean:
    rm -rf dist/