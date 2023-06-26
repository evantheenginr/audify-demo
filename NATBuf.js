class NATBuf {
  list = undefined;
  size = 0;
  min = 0;
  constructor(size) {
    this.size = size;
    this.list = new Array();
    /*this.timer = setInterval(() => {
        console.log(this.list)
    }, 1000)*/
  }

  static encode(seq, pcm) {
    return Buffer.concat([Buffer.from([seq >> 24, seq >> 16, seq >> 8, seq]), pcm]);
  }

  add(item) {
    const stats = { overflow: false, oos: false }
    if(item.seq > this.min){
        if (this.list.length === 0) {
            this.list.push(item);
        }else{
            const index = this.list.findIndex((el) => el.seq <= item.seq);
            if(index === -1 && this.list.length < this.size){
                this.list.push(item);
                stats.oos = true;
            } else if (index === 0) {
                this.list.unshift(item);
            }else if(index > 0){
                this.list.splice(index, 0, item);
                stats.oos = true;
            }
            if (/*index > -1 && */ this.list.length > this.size) {
                this.list.shift();
                stats.overflow = true;
            }
        }
    }else{
        stats.oos = true;
    }
    return stats;
  }

  read() {
    const ret = this.list.pop();
    if(ret !== undefined){
        this.min = ret.seq;
    }
    return ret;
  }
}

exports.NATBuf = NATBuf;