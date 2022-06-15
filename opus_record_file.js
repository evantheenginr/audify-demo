const { RtAudio, RtAudioFormat, OpusEncoder, OpusApplication } = require("audify")
const fs = require('fs')

// Init RtAudio instance using default sound API
const rtAudio = new RtAudio(/* Insert here specific API if needed */)
const numChannel = 1        // Number of channels
const samplingRate = 48000  // Sampling rate is 48kHz
const frameSize = 1920      // 40 ms
const numSamplePerSecond = samplingRate / frameSize
const encoder = new OpusEncoder(samplingRate, numChannel, OpusApplication.OPUS_APPLICATION_AUDIO)

var userArgs = process.argv.slice(2)
var fileName = ''
var duration = 0
var numPcmCapture = 0
var inputDeviceId = 0

if (userArgs.length == 3) {
  inputDeviceId = parseInt(userArgs[0])
  if (inputDeviceId < 0)
    inputDeviceId = rtAudio.getDefaultInputDevice()
  fileName = userArgs[1]
  duration =  parseInt(userArgs[2])
  numPcmCapture = duration * numSamplePerSecond
} else {
  console.log(process.argv[1], '<input device id> <output file> <duration seconds>')
  console.log(' \toutput device id: -1(default))')
  console.log('audio devices:')
  rtAudio.getDevices().forEach((info, index) => console.log(`\t[${index}] ${info.name}`))
  process.exit(1)
}

var pcmCount = 0
var writeNBytes = 0

var wstream = fs.createWriteStream(fileName)
wstream.on('error',  (error) => {
  console.log(`An error occured while writing to the file. Error: ${error.message}`)
  process.exit(1)
})

wstream.on('finish', function () {
  console.log(`Recording done: ${fileName}`)
  process.exit(0)
})

function handleAudio(pcm) {
  // A type of pcm is Buffer.
  // pcm.length == 3840 : 2 bytes * 1920
  // typical Opus encoded data size: about 238

  let opusData = encoder.encode(pcm, frameSize)

  // write encoded data size 
  const buf = Buffer.alloc(2)
  buf.writeInt16LE(opusData.length)
  wstream.write(buf)
  writeNBytes += buf.length
  
  // write encoded data size 
  wstream.write(opusData)
  writeNBytes += opusData.length
  
  if ((++pcmCount % numSamplePerSecond) == 0) {
    process.stdout.write('.')
    if ((pcmCount % (numSamplePerSecond * 60)) == 0) {
      process.stdout.write('\n')
    }
  }
  if (pcmCount > numPcmCapture) {
    console.log(`\n${pcmCount} times, ${writeNBytes} bytes written`)
    rtAudio.stop()
    wstream.end()
  }
}

rtAudio.openStream(
  null, // Output Device is null due to not used
  { deviceId: inputDeviceId, // Input device id (Get all devices using `getDevices`)
    nChannels: numChannel, // Number of channels
    firstChannel: 0 // First channel index on device (default = 0).
  },
  RtAudioFormat.RTAUDIO_SINT16, // PCM Format - Signed 16-bit integer
  samplingRate,
  frameSize,
  "MyStream", // The name of the stream (used for JACK Api)
  handleAudio
)

rtAudio.start()
console.log(`Start recording... ${duration} seconds`)
