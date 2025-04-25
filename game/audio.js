class AudioManager {
  constructor() {
    this.audio = {};
    this.isMuted = false;
  }

  setAudioElement(name, url) {
    const audioElement = document.createElement("audio");
    document.body.appendChild(audioElement);
    audioElement.setAttribute("src", url);
    this.audio[name] = audioElement;
  }

  preload(data) {
    const prefix = "data:audio/mp3;base64"
    this.setAudioElement("glass", `${prefix},${data[0]}`);
    this.setAudioElement("background", `${prefix},${data[1]}`);
    this.setAudioElement("jump", `${prefix},${data[2]}`);
  }

  loop(name) {
    if (this.isMuted) return;
    if (this.audio[name]) {
      // Set the audio to loop
      this.audio[name].loop = true;
      
      // If it's not already playing, start it
      if (this.audio[name].paused) {
        this.audio[name].play().catch((error) => {
          console.log(`Audio ${name} loop failed:`, error);
        });
      }
    } else {
      console.log(`Audio ${name} not found`);
    }
  }

  // Add a method to stop looping but continue playing
  stopLoop(name) {
    if (this.audio[name]) {
      this.audio[name].loop = false;
    } else {
      console.log(`Audio ${name} not found`);
    }
  }
  play(name, resume = false) {
    if (this.isMuted) return;
    if (this.audio[name]) {
      if (!this.audio[name].paused) {
        this.audio[name].pause();
        if (!resume) {
          this.audio[name].currentTime = 0;
        }
      }
      this.audio[name].play().catch((error) => {
        console.log(`Audio ${name} play failed:`, error);
      });
    } else {
      console.log(`Audio ${name} not found`);
    }
  }

  pause(name) {
    if (this.audio[name]) {
      if (!this.audio[name].paused) {
        this.audio[name].pause();
      } else {
        console.log(`Audio ${name} is already paused`);
      }
    } else {
      console.log(`Audio ${name} not found`);
    }
  }

  stop(name) {
    if (this.audio[name]) {
      this.audio[name].pause();
      this.audio[name].currentTime = 0;
    } else {
      console.log(`Audio ${name} not found`);
    }
  }

  isPlaying(name) {
    if (this.audio[name]) {
      return !this.audio[name].paused;
    } else {
      console.log(`Audio ${name} not found`);
      return false;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    Object.values(this.audio).forEach((audio) => {
      audio.muted = this.isMuted;
      if (this.isMuted) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }
}

let audioManager = new AudioManager();