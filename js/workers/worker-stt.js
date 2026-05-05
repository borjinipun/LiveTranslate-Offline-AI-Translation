import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio, language } = event.data;

  if (type === 'load') {
    try {
      await PipelineSingleton.getInstance(x => {
        self.postMessage({ type: 'progress', data: x });
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  } else if (type === 'transcribe') {
    try {
      const transcriber = await PipelineSingleton.getInstance();
      
      // We expect audio to be a Float32Array containing 16kHz audio data
      const result = await transcriber(audio, {
        language: language || 'en',
        task: 'transcribe'
      });
      
      self.postMessage({ type: 'result', text: result.text });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
});
