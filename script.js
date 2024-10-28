let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioUrl = null;
let recording = false;
let paused = false;
let stream = null;

const controlButton = document.getElementById('controlButton');
const controlIcon = document.getElementById('controlIcon');
const stopButton = document.getElementById('stopButton');
const audioPlayer = document.getElementById('audioPlayer');
const downloadButton = document.getElementById('downloadAudio');
const convertButton = document.getElementById('convertText');
const transcriptionArea = document.getElementById('transcription');

window.addEventListener('beforeunload', () => {
    cleanupResources();
});

function cleanupResources() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
    }
}

controlButton.addEventListener('click', async () => {
    try {
        if (!recording) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            audioChunks = [];
            
            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                if (audioChunks.length > 0) {
                    if (audioUrl) {
                        URL.revokeObjectURL(audioUrl);
                    }
                    audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    audioUrl = URL.createObjectURL(audioBlob);
                    audioPlayer.src = audioUrl;
                    downloadButton.disabled = false;
                    convertButton.disabled = false;
                }
            };

            mediaRecorder.start(10);
            controlIcon.className = 'fas fa-pause';
            recording = true;
            paused = false;
            stopButton.disabled = false;
            downloadButton.disabled = true;
            convertButton.disabled = true;

        } else {
            if (paused) {
                mediaRecorder.resume();
                controlIcon.className = 'fas fa-pause';
                paused = false;
            } else {
                mediaRecorder.pause();
                controlIcon.className = 'fas fa-microphone';
                paused = true;
            }
        }
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Unable to access microphone. Please ensure you have granted permission.');
    }
});

stopButton.addEventListener('click', () => {
    if (recording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        controlIcon.className = 'fas fa-microphone';
        recording = false;
        stopButton.disabled = true;
    }
});

downloadButton.addEventListener('click', () => {
    if (audioUrl) {
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `recording_${new Date().toISOString()}.webm`;
        a.click();
    }
});

convertButton.addEventListener('click', async () => {
    if (!audioUrl) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support speech recognition.");
        return;
    }

    try {
        // Show loading state
        convertButton.disabled = true;
        transcriptionArea.value = 'Converting speech to text...';

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let transcript = '';

        recognition.onresult = event => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    transcript += event.results[i][0].transcript + ' ';
                    transcriptionArea.value = transcript;
                }
            }
        };

        recognition.onerror = event => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'network') {
                transcriptionArea.value = 'Network error occurred. Please check your internet connection and try again.';
            } else {
                transcriptionArea.value = `Speech recognition error: ${event.error}`;
            }
            convertButton.disabled = false;
        };

        recognition.onend = () => {
            convertButton.disabled = false;
            if (!transcript) {
                transcriptionArea.value = 'No speech was recognized. Please try again.';
            }
        };

        // Create a new audio context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Fetch and decode the audio
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Create source and connect it
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        // Start recognition and playback
        recognition.start();
        source.start(0);

        // Clean up when done
        source.onended = () => {
            setTimeout(() => {
                recognition.stop();
                audioContext.close();
            }, 1000); // Give a small delay to ensure all speech is processed
        };

    } catch (error) {
        console.error('Error during speech recognition:', error);
        transcriptionArea.value = 'Error processing audio for speech recognition. Please try again.';
        convertButton.disabled = false;
    }
});