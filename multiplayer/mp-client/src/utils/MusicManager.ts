import { Scene } from 'phaser';

/**
 * Manages background music playback in the game.
 * Handles looping music and switching between different tracks.
 */
export class MusicManager {
    private scene: Scene;
    private currentMusic: Phaser.Sound.WebAudioSound | undefined = undefined;
    private currentMusicKey: string | undefined = undefined;
    /** Last track requested (kept after stop so re-enable can resume). */
    private lastRequestedFile: string | undefined = undefined;
    private musicVolume = 100; // Default volume (0-100)
    /** SysMenu Music On/Off — when false, playMusic is a no-op and current BGM stops. */
    private musicEnabled = true;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Updates the scene reference (useful when scene is recreated).
     * 
     * @param scene - The new scene instance
     */
    public setScene(scene: Scene): void {
        this.scene = scene;
    }

    /**
     * SysMenu Music toggle. Off stops BGM immediately.
     * On only flips the flag — caller (GameWorld) resumes map/selected track when appropriate.
     */
    public setMusicEnabled(enabled: boolean): void {
        this.musicEnabled = enabled;
        if (!enabled) {
            this.stopPlaybackOnly();
            console.log('[MusicManager] Music disabled');
            return;
        }
        console.log('[MusicManager] Music enabled');
    }

    /** Last track requested via playMusic (survives disable for optional resume). */
    public getLastRequestedMusic(): string | undefined {
        return this.lastRequestedFile;
    }

    public isMusicEnabled(): boolean {
        return this.musicEnabled;
    }

    /**
     * Plays the specified music file in a loop.
     * If the same music is already playing, continues playing without restarting.
     * If a different music is playing, stops it and starts the new one.
     * When music is disabled, remembers the request but does not play.
     * 
     * @param fileName - The name of the .mp3 file (e.g., 'default.mp3')
     */
    public playMusic(fileName: string): void {
        this.lastRequestedFile = fileName;

        if (!this.musicEnabled) {
            console.log(`[MusicManager] Music disabled — not playing: ${fileName}`);
            return;
        }

        // If the same music is already playing, do nothing
        if (this.currentMusicKey === fileName && this.currentMusic && this.currentMusic.isPlaying) {
            return;
        }

        // Stop current music if playing
        this.stopPlaybackOnly();

        // Extract key from filename (remove .mp3 extension)
        const musicKey = fileName.replace('.mp3', '');

        // Check if the audio exists in cache
        if (!this.scene.cache.audio.exists(musicKey)) {
            console.warn(`[MusicManager] Music file not found in cache: ${fileName}`);
            return;
        }

        // Create and play the new music
        const phaserVolume = this.musicVolume / 100; // Convert to Phaser's volume range (0-1)
        this.currentMusic = this.scene.sound.add(musicKey, {
            loop: true,
            volume: phaserVolume
        }) as Phaser.Sound.WebAudioSound;

        // Play with loop enabled to ensure music loops continuously
        this.currentMusic.play({ loop: true });
        this.currentMusicKey = fileName;

        console.log(`[MusicManager] Playing music: ${fileName}`);
    }

    /**
     * Stops the currently playing music and clears the last-requested track
     * (e.g. logout / explicit silence with no resume intent).
     */
    public stopMusic(): void {
        this.stopPlaybackOnly();
        this.lastRequestedFile = undefined;
        console.log('[MusicManager] Music stopped');
    }

    /**
     * Stops current BGM without clearing last requested track
     * (e.g. "Play map music" Off — map load may resume later).
     */
    public silence(): void {
        this.stopPlaybackOnly();
        console.log('[MusicManager] Music silenced');
    }

    /** Stops playback without forgetting lastRequestedFile (for mute / disable). */
    private stopPlaybackOnly(): void {
        if (this.currentMusic) {
            if (this.currentMusic.isPlaying) {
                this.currentMusic.stop();
            }
            this.currentMusic.destroy();
            this.currentMusic = undefined;
            this.currentMusicKey = undefined;
        }
    }

    /**
     * Gets the currently playing music file name.
     * 
     * @returns The current music file name or undefined if no music is playing
     */
    public getCurrentMusic(): string | undefined {
        return this.currentMusicKey;
    }

    /**
     * Sets the music volume.
     * 
     * @param volume - Volume level between 0 and 100 (0 = silent, 100 = full volume)
     */
    public setMusicVolume(volume: number): void {
        // Clamp volume between 0 and 100
        const clampedVolume = Math.max(0, Math.min(100, volume));
        this.musicVolume = clampedVolume;
        // Convert to Phaser's volume range (0-1)
        const phaserVolume = clampedVolume / 100;

        // Update current music if playing
        if (this.currentMusic) {
            // Phaser sounds have a volume property that can be set directly
            this.currentMusic.setVolume(phaserVolume);
        }

        console.log(`[MusicManager] Music volume set to ${clampedVolume}%`);
    }

    /**
     * Gets the current music volume.
     * 
     * @returns Volume level between 0 and 100
     */
    public getMusicVolume(): number {
        return this.musicVolume;
    }
}
