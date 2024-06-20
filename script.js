let mediaRecorder;
let audioChunks = [];
let audioBlob;
let audioUrl;

document.getElementById('startRecord').addEventListener('click', async () => {
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        audioUrl = URL.createObjectURL(audioBlob);
        document.getElementById('audioPlayer').src = audioUrl;
        audioChunks = [];
        document.getElementById('downloadAudio').disabled = false;
        document.getElementById('convertText').disabled = false;
    };

    document.getElementById('startRecord').disabled = true;
    document.getElementById('stopRecord').disabled = false;
});

document.getElementById('stopRecord').addEventListener('click', () => {
    mediaRecorder.stop();
    document.getElementById('startRecord').disabled = false;
    document.getElementById('stopRecord').disabled = true;
});

document.getElementById('downloadAudio').addEventListener('click', () => {
    let a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'recording.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

document.getElementById('convertText').addEventListener('click', () => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        alert("Your browser does not support speech recognition.");
        return;
    }

    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
        let transcript = event.results[0][0].transcript;
        document.getElementById('transcription').value = transcript;
    };

    recognition.onerror = event => {
        console.error(event.error);
        alert("Error occurred in speech recognition: " + event.error);
    };

    recognition.onend = () => {
        console.log('Speech recognition service disconnected');
    };

    let audioContext = new AudioContext();
    fetch(audioUrl)
        .then(response => response.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .then(decodedData => {
            let source = audioContext.createBufferSource();
            source.buffer = decodedData;

            let dest = audioContext.createMediaStreamDestination();
            source.connect(dest);
            source.start(0);

            let recorder = new MediaRecorder(dest.stream);
            recorder.ondataavailable = event => {
                let newAudioBlob = new Blob([event.data], { type: 'audio/wav' });
                recognition.start();
                let reader = new FileReader();
                reader.onload = () => {
                    recognition.onend = () => {
                        console.log('Speech recognition service disconnected');
                    };
                    recognition.onresult = event => {
                        let transcript = event.results[0][0].transcript;
                        document.getElementById('transcription').value = transcript;
                    };
                    recognition.onerror = event => {
                        console.error(event.error);
                        alert("Error occurred in speech recognition: " + event.error);
                    };
                };
                reader.readAsDataURL(newAudioBlob);
            };
            recorder.start();
            source.onended = () => {
                recorder.stop();
            };
        });
});
