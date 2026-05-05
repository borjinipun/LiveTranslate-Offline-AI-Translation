/**
 * SpeechInputManager — supports both Web Speech API and offline Transformers.js STT.
 */
export default class SpeechInputManager {
  constructor() {
    // Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupportedWeb = !!SpeechRecognition;
    
    // Offline STT
    this.isSupportedOffline = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    this.isSupported = this.isSupportedWeb || this.isSupportedOffline;
    
    // Default to Offline if it was the preference, but user can toggle
    this.useOfflineSTT = true;
    
    this.isListening = false;
    
    this._onInterim = null;
    this._onFinal = null;
    this._onError = null;
    this._onEnd = null;
    this._onStatus = null;
    
    // Web Speech API Init
    this._recognition = null;
    if (this.isSupportedWeb) {
      this._recognition = new SpeechRecognition();
      this._recognition.continuous = true;
      this._recognition.interimResults = true;
      
      this._recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (interim && this._onInterim) this._onInterim(interim);
        if (final && this._onFinal) this._onFinal(final);
      };
      
      this._recognition.onerror = (event) => {
        if (this._onError) this._onError(new Error(event.error));
      };
      
      this._recognition.onend = () => {
        if (this.isListening && !this.useOfflineSTT) {
          this.isListening = false;
          if (this._onEnd) this._onEnd();
        }
      };
    }

    // Offline STT Init
    this._worker = new Worker('./js/workers/worker-stt.js', { type: 'module' });
    this._isWorkerReady = false;
    
    this._audioContext = null;
    this._mediaStream = null;
    this._sourceNode = null;
    this._processorNode = null;
    
    this._audioData = [];
    this._lastOfflineText = '';
    this._offlineSilenceTimer = null;

    this._worker.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        if (this._onStatus) this._onStatus(msg.data);
      } else if (msg.type === 'ready') {
        this._isWorkerReady = true;
        if (this._onStatus) this._onStatus({ status: 'ready' });
      } else if (msg.type === 'result') {
        this._isProcessing = false;
        
        if (this._isFinalizing) {
           if (this._onFinal) this._onFinal(msg.text);
           if (this._onEnd) this._onEnd();
           this._isFinalizing = false;
        } else {
           if (msg.text !== this._lastOfflineText && msg.text.trim()) {
             this._lastOfflineText = msg.text;
             if (this._onInterim) this._onInterim(msg.text);
             
             // Pause detection logic for offline STT (acts like Web Speech API isFinal)
             clearTimeout(this._offlineSilenceTimer);
             this._offlineSilenceTimer = setTimeout(() => {
               if (this.isListening && this.useOfflineSTT) {
                 if (this._onFinal) this._onFinal(msg.text);
                 this._lastOfflineText = '';
                 this.clearBuffer();
               }
             }, 1500);
           }
        }
      } else if (msg.type === 'error') {
        this._isProcessing = false;
        if (this._onError) this._onError(new Error(msg.error));
        if (this._onEnd) this._onEnd();
      }
    });
    
    // Start loading the offline model immediately
    this._worker.postMessage({ type: 'load' });
  }
  
  setEngine(useOffline) {
    if (this.isListening) {
      this.stop(); // stop current engine before switching
    }
    this.useOfflineSTT = useOffline;
  }

  onStatus(callback) {
    this._onStatus = callback;
  }

  async start({ lang = 'en', onInterim, onFinal, onError, onEnd } = {}) {
    if (!this.isSupported) {
      console.warn('[Speech] Neither Web Speech nor Offline STT is supported.');
      return false;
    }
    if (this.isListening) return false;

    this._onInterim = onInterim;
    this._onFinal = onFinal;
    this._onError = onError;
    this._onEnd = onEnd;
    this._lang = lang;
    
    this.isListening = true;

    if (!this.useOfflineSTT && this.isSupportedWeb) {
      try {
        this._recognition.lang = lang;
        this._recognition.start();
        return true;
      } catch(err) {
        console.error('[Speech] Web Speech API start error:', err);
        this.isListening = false;
        return false;
      }
    } else if (this.useOfflineSTT && this.isSupportedOffline) {
      if (!this._isWorkerReady) {
        console.warn('[Speech] STT Worker is not ready yet.');
        this.isListening = false;
        return false;
      }

      try {
        this._mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream);
        
        this._processorNode = this._audioContext.createScriptProcessor(4096, 1, 1);
        this._audioData = [];
        this._isProcessing = false;
        this._isFinalizing = false;
        this._lastOfflineText = '';
        
        let lastProcessTime = Date.now();
        
        this._processorNode.onaudioprocess = (e) => {
          if (!this.isListening || !this.useOfflineSTT) return;
          const inputData = e.inputBuffer.getChannelData(0);
          this._audioData.push(new Float32Array(inputData));
          
          const now = Date.now();
          // Send to worker every ~1000ms if not currently processing
          if (now - lastProcessTime > 1000 && !this._isProcessing) {
             lastProcessTime = now;
             this._sendAudioToWorker(false);
          }
        };

        this._sourceNode.connect(this._processorNode);
        this._processorNode.connect(this._audioContext.destination);

        return true;
      } catch (err) {
        console.error('[Speech] Error starting mic for offline STT:', err);
        if (this._onError) this._onError(err);
        this.isListening = false;
        return false;
      }
    } else {
      console.warn('[Speech] Selected engine is not supported.');
      this.isListening = false;
      return false;
    }
  }

  _sendAudioToWorker(isFinal) {
    const totalLength = this._audioData.reduce((acc, val) => acc + val.length, 0);
    if (totalLength === 0) {
      if (isFinal && this._isFinalizing) {
        // Trigger empty final
        if (this._onFinal) this._onFinal('');
        if (this._onEnd) this._onEnd();
        this._isFinalizing = false;
      }
      return;
    }
    
    const audioFloat32 = new Float32Array(totalLength);
    let offset = 0;
    for (let chunk of this._audioData) {
      audioFloat32.set(chunk, offset);
      offset += chunk.length;
    }
    
    this._isProcessing = true;
    this._isFinalizing = isFinal;
    
    this._worker.postMessage({
      type: 'transcribe',
      audio: audioFloat32,
      language: this._lang.split('-')[0]
    });
  }

  stop() {
    if (!this.isListening) return;
    this.isListening = false;
    
    if (!this.useOfflineSTT && this.isSupportedWeb) {
      this._recognition.stop();
    } else if (this.useOfflineSTT) {
      clearTimeout(this._offlineSilenceTimer);
      
      if (this._processorNode) {
        this._processorNode.disconnect();
        this._processorNode.onaudioprocess = null;
      }
      if (this._sourceNode) {
        this._sourceNode.disconnect();
      }
      if (this._audioContext) {
        this._audioContext.close();
      }
      if (this._mediaStream) {
        this._mediaStream.getTracks().forEach(track => track.stop());
      }
      
      // Final transcription request
      this._sendAudioToWorker(true);
    }
  }

  clearBuffer() {
    this._audioData = [];
  }
}
