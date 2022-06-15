const { RtAudio, RtAudioFormat, OpusDecoder } = require("audify")
const { promises } = require('fs')

// Init RtAudio instance using default sound API
const rtAudio = new RtAudio(/* Insert here specific API if needed */)
const numChannel = 1        // Number of channels
const samplingRate = 48000  // Sampling rate is 48kHz
const frameSize = 1920      // 40 ms
const numSamplePerSecond = samplingRate / frameSize
const decoder = new OpusDecoder(samplingRate, numChannel)

var userArgs = process.argv.slice(2)
var fileName = ''
var outputDeviceId = 0

if (userArgs.length == 2) {
  outputDeviceId = parseInt(userArgs[0])
  if (outputDeviceId < 0)
    outputDeviceId = rtAudio.getDefaultOutputDevice()
  fileName = userArgs[1]
} else {
  console.log(process.argv[1], '<output device id> <input file>')
  console.log(' \toutput device id: -1(default))')
  console.log('audio devices:')
  rtAudio.getDevices().forEach((info, index) => console.log(`\t[${index}] ${info.name}`))
  process.exit(1)
}

var pcmCount = 0
var writeNBytes = 0

rtAudio.openStream(
  { deviceId: outputDeviceId, // Output device id (Get all devices using `getDevices`)
    nChannels: numChannel,
    firstChannel: 0 // First channel index on device (default = 0).
  },
  null, // Input MIC device not used
  RtAudioFormat.RTAUDIO_SINT16, // PCM Format - Signed 16-bit integer
  samplingRate,
  frameSize,
  "MyStream", // The name of the stream (used for JACK Api)
  null
)

async function readAudioFrame(fd) {
  const headerSize = 2
  var sizeData = await fd.read(Buffer.alloc(headerSize), 0, headerSize, null)
  if (sizeData.bytesRead == 0) {
      console.log(`\nPlay finished: ${pcmCount} times, ${writeNBytes} bytes played`)
      await fd.close()
      process.exit(1)
  }
  writeNBytes += sizeData.bytesRead
  
  let dataSize = sizeData.buffer.readInt16LE()
  var opusData = await fd.read(Buffer.alloc(dataSize), 0, dataSize, null)
  writeNBytes += opusData.bytesRead
  var pcm = decoder.decode(opusData.buffer, frameSize)
  if ((++pcmCount % numSamplePerSecond) == 0) {
    process.stdout.write('.')
    if ((pcmCount % (numSamplePerSecond * 60)) == 0) {
      process.stdout.write('\n')
    }
  }
  rtAudio.write(pcm)
}

async function main() {
  fd = await promises.open(fileName, 'r')
  console.log(`Start playing...`)
  rtAudio.start()
  setInterval(readAudioFrame, 1000 / numSamplePerSecond, fd)
}

main()
