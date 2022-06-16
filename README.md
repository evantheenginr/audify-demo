# `audify` demo program

The [audify](https://almoghamdani.github.io/audify/index.html) is a nodejs package 
that wraps `rtAudio` a cross platform audio library written in C++ language.  
This example codes were created because there is no example code to use despite of that it is simple and works well.  

## Installation

* package installation  

```
cd <repository-directory>
npm install
```

## Demo Programm

* Recording / Playing Demo  

Recording audio source from default input audio device 10 seconds to file.  
```
$ node opus_record_file.js -1 test.opu 10
```

Playing a record file.  
```
$ node opus_play_file.js -1 test.opu
```

* UDP Chat Demo  

```
$ node opus_chat_udp.js -1 -1 192.168.1.100 3000
audiopy-demo> help
o
        PTT on
x
        PTT off
s
        Show PTT status.
q
        Quit program.

```
Enter `o` command than speek to peer.  
