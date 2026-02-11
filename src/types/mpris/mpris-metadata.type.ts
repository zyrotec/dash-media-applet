export type MprisMetadata = {
    title: string | null;
    artist: string[] | null;
    album: string | null;
    artUrl: string | null;
    length: number | null;
    albumArtist?: string[] | null;
    trackNumber?: number | null;
    discNumber?: number | null;
    url?: string | null;
};