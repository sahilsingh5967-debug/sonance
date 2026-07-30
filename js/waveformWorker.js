/**
 * Sonance WaveformWorker - Web Worker for Asynchronous Audio Peak Calculation
 * 
 * Offloads peak decoding chunk calculations from main thread to prevent UI freezing.
 */
self.onmessage = function (e) {
  const { channelData, samples } = e.data;

  if (!channelData || channelData.length === 0) {
    self.postMessage([]);
    return;
  }

  const sampleCount = samples || 200;
  const chunkSize = Math.floor(channelData.length / sampleCount);
  const peaks = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    let max = 0;

    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) {
        max = val;
      }
    }

    peaks[i] = max;
  }

  // Post peak array back to main thread
  self.postMessage(peaks);
};
