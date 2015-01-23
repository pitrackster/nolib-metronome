
var audioContext = null;
var isPlaying = false;      // Are we currently playing?
var startTime;              // The start time of the entire sequence.
var current16thNote;        // What note is currently last scheduled?
var tempo;          // tempo (in beats per minute)
var lookahead = 25.0;       // How frequently to call scheduling function 
//(in milliseconds)
var scheduleAheadTime = 0.1;    // How far ahead to schedule audio (sec)
// This is calculated from lookahead, and overlaps 
// with next interval (in case the timer is late)
var nextNoteTime = 0.0;     // when the next note is due.
var noteResolution = 2;     // 0 == 16th, 1 == 8th, 2 == quarter note
var noteLength = 0.05;      // length of "beep" (in seconds)

var notesInQueue = [];      // the notes that have been put into the web audio,
// and may or may not have played yet. {note, time}
var timerWorker = null;     // The Web Worker used to fire timer messages


var last = 0;


// First, let's shim the requestAnimationFrame API, with a setTimeout fallback
window.requestAnimFrame = (function () {
    return  window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback) {
                console.log('tooo bad');
                window.setTimeout(callback, 1000 / 60);
            };
})();

function nextNote() {
    // Advance current note and time by a 16th note...
    var secondsPerBeat = 60.0 / tempo;    // Notice this picks up the CURRENT 
    // tempo value to calculate beat length.
    nextNoteTime += 0.25 * secondsPerBeat;    // Add beat length to last beat time

    current16thNote++;    // Advance the beat number, wrap to zero
    if (current16thNote === 16) {
        current16thNote = 0;
    }
}

function scheduleNote(beatNumber, time) {
    // push the note on the queue, even if we're not playing.
    notesInQueue.push({note: beatNumber, time: time});

    if (beatNumber % 4)
        return; // we're not playing non-quarter 8th notes

    // create an oscillator
    var osc = audioContext.createOscillator();
    osc.frequency.value = 880.0;
    osc.connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + noteLength);
    
    flashIt();
}

function scheduler() {
    // while there are notes that will need to play before the next interval, 
    // schedule them and advance the pointer.
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
        scheduleNote(current16thNote, nextNoteTime);
        nextNote();
    }
}

function play() {
    isPlaying = !isPlaying;
    if (isPlaying) { // start playing
        current16thNote = 0;
        nextNoteTime = audioContext.currentTime;
        timerWorker.postMessage("start");
        return "stop";
    }
}

function stop() {
    isPlaying = !isPlaying;
    if (!isPlaying) { // stop playing
        timerWorker.postMessage("stop");
        return "play";
    }
}

function flashIt() {
    document.getElementById('flash').classList.add('on');
    window.setTimeout(function () {
        document.getElementById('flash').classList.remove('on');
    }, 100);
}

function init() {


    // NOTE: THIS RELIES ON THE MONKEYPATCH LIBRARY BEING LOADED FROM
    // Http://cwilso.github.io/AudioContext-MonkeyPatch/AudioContextMonkeyPatch.js
    // TO WORK ON CURRENT CHROME!!  But this means our code can be properly
    // spec-compliant, and work on Chrome, Safari and Firefox.

    audioContext = new AudioContext();

    updateTempo();

    // if we wanted to load audio files, etc., this is where we should do it.
    timerWorker = new Worker("js/metronomeworker.js");

    timerWorker.onmessage = function (e) {
        if (e.data === "tick") {
            scheduler();
        } else {
            console.log("message: " + e.data);
        }
    };
    timerWorker.postMessage({"interval": lookahead});
}


function updateTempo() {
    tempo = parseInt(document.getElementById('tempo-val').value);
}

window.addEventListener("load", init);


