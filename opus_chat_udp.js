const { RtAudio, RtAudioFormat, OpusEncoder, OpusDecoder, OpusApplication } = require("audify")
const udp = require('dgram')
const commandNode = require('command-node')

// Init RtAudio instance using default sound API
const rtAudio = new RtAudio(/* Insert here specific API if needed */)
const numChannel = 1        // Number of channels
const samplingRate = 48000  // Sampling rate is 48kHz
const frameSize = 1920      // 40 ms
const encoder = new OpusEncoder(samplingRate, numChannel, OpusApplication.OPUS_APPLICATION_AUDIO)
const decoder = new OpusDecoder(samplingRate, numChannel)
const server = udp.createSocket('udp4')
const client = udp.createSocket('udp4')

var userArgs = process.argv.slice(2)
var remoteIp = ''
var portNum = 0
var outputDeviceId = 0
var inputDeviceId = 0
var localPttOn = false
var remotePttOn = false

if (userArgs.length == 4) {
  inputDeviceId = parseInt(userArgs[0])
  if (inputDeviceId < 0)
    inputDeviceId = rtAudio.getDefaultInputDevice()
  outputDeviceId = parseInt(userArgs[1])
  if (outputDeviceId < 0)
    outputDeviceId = rtAudio.getDefaultOutputDevice()
  remoteIp = userArgs[2]
  portNum =  parseInt(userArgs[3])
} else {
  console.log(process.argv[1], '<input device id> <output device id> <remote ip> <remote port>')
  console.log(' -  input device id: -1(default))')
  console.log(' - output device id: -1(default))')
  console.log(' - audio devices:')
  rtAudio.getDevices().forEach((info, index) => console.log(`\t[${index}] ${info.name}`))
  process.exit(1)
}

function handleAudio(pcm) {
  if (!localPttOn)
    return
  let opusData = encoder.encode(pcm, frameSize)
  client.send(opusData, portNum, remoteIp)
}

rtAudio.openStream(
  { deviceId: outputDeviceId, // Output device id (Get all devices using `getDevices`)
    nChannels: numChannel,
    firstChannel: 0 // First channel index on device (default = 0).
  },
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

// emits when any error occurs
server.on('error', function(error){
  console.log('Server socket error: ' + error)
  server.close()
})

// emits on new datagram msg
var timer = null
server.on('message', function(msg, info) {
  //console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port)
  setRemotePtt(true)
  clearTimeout(timer)
  // setRemotePtt(false) when RX data timeout occured
  timer = setTimeout(setRemotePtt, 300, false)
  const pcm = decoder.decode(msg, frameSize)
  rtAudio.write(pcm)
})

server.bind(portNum)

function audioStart(isStart) {
  if (isStart) {
    if (!rtAudio.isStreamRunning()) {
      console.log(`audio start: local=${localPttOn} remote=${remotePttOn}`)
      rtAudio.start()
    }
  } else {
    if (rtAudio.isStreamRunning()) {
      console.log(`audio stop: local=${localPttOn} remote=${remotePttOn}`)
      rtAudio.stop()
    }
  }
}

function setLocalPtt(isOn) {
  if (localPttOn == isOn)
    return
  localPttOn = isOn
  console.log(`local PTT: ${isOn}`)
  if (localPttOn) {
    audioStart(true)
  } else if (!remotePttOn) {
    audioStart(false)
  }
}

function setRemotePtt(isOn) {
  if (remotePttOn == isOn)
    return
  console.log(`remote PTT: ${isOn}`)
  remotePttOn = isOn
  if (remotePttOn) {
    audioStart(true)
  } else if (!localPttOn) {
    audioStart(false)
  }
}

function pttOn(commands) {
  if (localPttOn) {
    console.log(`PTT already on`)
  } else {
    setLocalPtt(true)
    console.log(`PTT: ${localPttOn ? 'ON' : 'OFF'}`)
  }
}

function pttOff(commands) {
  if (!localPttOn) {
    console.log(`PTT already off`)
  } else {
    setLocalPtt(false)
    console.log(`PTT: ${localPttOn ? 'ON' : 'OFF'}`)
  }
}

function pttStat(commands) {
  console.log(`PTT: local=${localPttOn ? 'ON' : 'OFF'} remote=${remotePttOn ? 'ON' : 'OFF'}`)
}

var commands = {
  'o': {
      parameters: [],
      description: '\tPTT on',
      handler: pttOn
  },
  'x': {
      parameters: [],
      description: '\tPTT off',
      handler: pttOff
  },
  's': {
      parameters: [],
      description: '\tShow PTT status.',
      handler: pttStat
  },
  'q': {
    parameters: [],
    description: '\tQuit program.',
    handler: x => process.exit(1)
  },
}

commandNode.initialize(commands, 'audiopy-demo> ')
