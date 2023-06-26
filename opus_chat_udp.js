const { RtAudio, RtAudioFormat, OpusEncoder, OpusDecoder, OpusApplication, RtAudioStreamFlags } = require('audify')
const udp = require('dgram')
const commandNode = require('command-node')
const { NATBuf } = require('./NATBuf')

// Init RtAudio instance using default sound API
const rtAudio = new RtAudio(/* Insert here specific API if needed */)
const numChannel = 1        // Number of channels
const samplingRate = 48000  // Sampling rate is 48kHz
const encoder = new OpusEncoder(samplingRate, numChannel, OpusApplication.OPUS_APPLICATION_RESTRICTED_LOWDELAY)
const decoder = new OpusDecoder(samplingRate, numChannel)
const server = udp.createSocket('udp4')
const client = udp.createSocket('udp4')

const stats = { pk_sent: 0, pk_rcvd: 0, kb_sent: 0, kb_rcvd: 0, underruns: 0, overflow: 0, oos: 0 }

var userArgs = process.argv.slice(2)
var frameSize = 120      // 40 ms at 1920, so 2.5 ms at 120 (1/48000*1000*120)
var queue = 4
var remoteIp = ''
var portNum = 0
var outputDeviceId = 0
var inputDeviceId = 0
var outputSeq = 0;
var inputSeq = 0;
var playing = false;

if (userArgs.length == 6) {
  inputDeviceId = parseInt(userArgs[0])
  if (inputDeviceId < 0)
    inputDeviceId = rtAudio.getDefaultInputDevice()
  outputDeviceId = parseInt(userArgs[1])
  if (outputDeviceId < 0)
    outputDeviceId = rtAudio.getDefaultOutputDevice()
  remoteIp = userArgs[2]
  portNum =  parseInt(userArgs[3])
  queue = parseInt(userArgs[4])
  frameSize = parseInt(userArgs[5])

} else {
  console.log(process.argv[1], '<input device id> <output device id> <remote ip> <remote port>')
  console.log(' -  input device id: -1(default))')
  console.log(' - output device id: -1(default))')
  console.log(' - audio devices:')
  rtAudio.getDevices().forEach((info, index) => console.log(`\t[${index}] ${info.name}`))
  process.exit(1)
}

const buf = new NATBuf(queue);

function handleOutboundAudio(pcm) {
  outputSeq = (outputSeq + 1) % 4294967295
  const data = NATBuf.encode(outputSeq, encoder.encode(pcm, frameSize))
  client.send(data, portNum, remoteIp)
  stats.pk_sent++;
  stats.kb_sent += data.length/1024;
}

function handleInboundAudio(){
  const pcm = buf.read()?.pcm
  if(pcm !== undefined){
    playing = true;
    rtAudio.write(Buffer.concat([pcm, pcm]))
  }else{
    playing = false;
    stats.underruns++;
  }
}

rtAudio.openStream(
  { deviceId: outputDeviceId, // Output device id (Get all devices using `getDevices`)
    nChannels: 2,
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
  handleOutboundAudio,
  handleInboundAudio,
  RtAudioStreamFlags.RTAUDIO_SCHEDULE_REALTIME | RtAudioStreamFlags.RTAUDIO_NONINTERLEAVED
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
  const { overflow, oos } = buf.add({seq: msg.readUInt32BE(0), pcm: decoder.decode(msg.slice(4), frameSize)})
  if(inputSeq < queue){
    inputSeq++
  }
  if(!playing && inputSeq > queue-1){
    handleInboundAudio()
  }
  if (overflow) {
    stats.overflow++
  }
  if (oos) {
    stats.oos++
  }
  stats.pk_rcvd++
  stats.kb_rcvd += msg.length/1024
})

server.bind(portNum)

function audioStart(isStart) {
  if (isStart) {
    if (!rtAudio.isStreamRunning()) {
      console.log(`audio start`)
      rtAudio.start()
      timer = setInterval(() => {
        console.log(stats);
        stats.pk_sent = 0;
        stats.pk_rcvd = 0;
        stats.kb_sent = 0;
        stats.kb_rcvd = 0;
        stats.underruns = 0;
        stats.overflow = 0;
        stats.oos = 0;
      }, 1000)
    }
  } else {
    if (rtAudio.isStreamRunning()) {
      console.log(`audio stop`)
      rtAudio.stop()
      clearInterval(timer)
    }
  }
}

var commands = {
  'r': {
    parameters: [],
    description: '\Run Test.',
    handler: x => audioStart(true)
  },
  'x': {
    parameters: [],
    description: '\Stop Test.',
    handler: x => audioStart(false)
  },
  'q': {
    parameters: [],
    description: '\tQuit program.',
    handler: x => process.exit(1)
  },
}

commandNode.initialize(commands, 'audiopy-demo> ')
