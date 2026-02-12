import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ZyrotecDashComponent } from './components/zyrotec-dash-component.ui.js';
import { MPRIS_CHANGED_SIGNALS } from './enums/mpris/mpris-changed-signals.enum.js';
import { MprisService } from './services/mpris/mpris-service.js';
import { MprisMetadata } from './types/mpris/mpris-metadata.type.js';

export default class MyExtension extends Extension {
  private _mprisService?: MprisService;
  private _zyrotecDashComponent?: ZyrotecDashComponent;

  private _signalIds: number[] = [];
  private _sessionSignalId?: number;

  private _updateMetadata(metadata: MprisMetadata | null): void {
    if (!metadata) {
      return;
    }

    const artUrl = metadata.artUrl ?? "";
    const title = metadata.title ?? 'Unknown Title';
    let artist = "";

    if (Array.isArray(metadata.artist)) {
      artist = metadata.artist.map(a => typeof a === 'object' && 'unpack' in a ? (a as any).unpack() : a).join(', ');
    } else {
      if (typeof metadata.artist === 'object' && 'unpack' in (metadata.artist ?? {})) {
        artist = (metadata.artist as any)?.unpack();
      } else {
        artist = (metadata.artist as any);
      }
    }

    if (artist === "") {
      artist = "Unknown Artist";
    }

    this._zyrotecDashComponent?.setMediaArtUrl(artUrl);
    this._zyrotecDashComponent?.setMediaTitle(title);
    this._zyrotecDashComponent?.setMediaArtist(artist);
  }

  private _syncSession(): void {
    if (!this._mprisService || !this._zyrotecDashComponent) {
      return;
    }

    if (!this._mprisService.isMprisConnected()) {
      this._zyrotecDashComponent.getComponent().visible = false;
      this._zyrotecDashComponent.setMediaArtUrl("");
      this._zyrotecDashComponent.setMediaTitle("");
      this._zyrotecDashComponent.setMediaArtist("");
      return;
    }

    this._zyrotecDashComponent.getComponent().visible = true;

    const metadata = this._mprisService.getMprisMetadata();
    this._updateMetadata(metadata);
  }

  private _handleMprisSignals(): void {
    if (!this._mprisService) {
      return;
    }

    const mprisConnectedSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playerConnected, this._syncSession.bind(this));
    const mprisDisconnectedSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playerDisconnected, this._syncSession.bind(this));
    const mprisMetaDataSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.metadataChanged, (_, args: MprisMetadata) => {
      this._updateMetadata(args);
    });

    this._signalIds = [...this._signalIds, ...[mprisConnectedSignal, mprisDisconnectedSignal, mprisMetaDataSignal]];

    this._sessionSignalId = Main.sessionMode.connect(
      "updated",
      this._syncSession.bind(this)
    );
  }

  enable() {
    this._mprisService = new MprisService();
    this._zyrotecDashComponent = new ZyrotecDashComponent();

    Main.overview.dash._box.add_child(this._zyrotecDashComponent.getComponent());

    this._handleMprisSignals();
    this._syncSession();
  }

  disable() {
    for (const signalId of this._signalIds) {
      if (!this._mprisService) {
        continue;
      }

      this._mprisService.disconnect(signalId);
    }

    this._signalIds = [];

    if (this._sessionSignalId) {
      Main.sessionMode.disconnect(this._sessionSignalId);
    }

    this._zyrotecDashComponent?.destroy();
    this._mprisService?.destroy();

    this._zyrotecDashComponent = undefined;
    this._mprisService = undefined;
  }
}