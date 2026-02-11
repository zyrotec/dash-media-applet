import GLib from "gi://GLib";

export type MprisRawMetadata = {
    'xesam:title'?: GLib.Variant;
    'xesam:artist'?: GLib.Variant;
    'xesam:album'?: GLib.Variant;
    'xesam:albumArtist'?: GLib.Variant;
    'xesam:trackNumber'?: GLib.Variant;
    'xesam:discNumber'?: GLib.Variant;
    'xesam:url'?: GLib.Variant;
    'mpris:artUrl'?: GLib.Variant;
    'mpris:length'?: GLib.Variant;
    'mpris:trackid'?: GLib.Variant;
    [key: string]: GLib.Variant | undefined;
};