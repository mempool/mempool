import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  audio: HTMLAudioElement;
  isPlaying = false;

  constructor() {
    try {
      this.audio = new Audio();
    } catch (e) {}
  }

  public playSound(name: 'magic' | 'chime' | 'cha-ching' | 'bright-harmony' | 'wind-chimes-harp-ascend' | 'ascend-chime-cartoon') {
    if (this.isPlaying || !this.audio) {
      return;
    }
    this.isPlaying = true;
    this.audio.src = '/resources/sounds/' + name + '.mp3';
    this.audio.load();
    this.audio.volume = 0.65; // 65% volume
    this.audio.play().catch((e) => {
      console.log('Play sound failed' + e);
    });
    setTimeout(() => this.isPlaying = false, 100);
  }
}
