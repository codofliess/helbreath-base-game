import WebSocket from 'ws';
import * as net from '../src/proto/generated/network.ts';
console.log('keys', Object.keys(net).filter(k => /Client|Server|Message/.test(k)).slice(0,30));
const ClientMessage = (net as any).ClientMessage;
const ServerMessage = (net as any).ServerMessage;
const wallet = '36zA4DKL4jxvmLkqsvtF9RtzRAwSjscTvfkQPKJNim5g';
const ws = new WebSocket('wss://play.chainlords.net/ws');
const t = setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 10000);
ws.on('open', () => {
  console.log('open');
  const packet = ClientMessage.encode({
    payload: { $case: 'characterListRequest', value: { id: wallet, authToken: '', playerMode: 1 } },
  }).finish();
  console.log('send', packet.length);
  ws.send(packet);
});
ws.on('message', (data: any) => {
  const buf = new Uint8Array(data);
  console.log('msg', buf.length);
  const msg = ServerMessage.decode(buf);
  console.log('case', msg.payload?.$case);
  if (msg.payload?.$case === 'characterListResponse') {
    console.log(msg.payload.value.characters?.map((c: any) => c.name + ' L' + c.level));
    clearTimeout(t); ws.close(); process.exit(0);
  }
  console.log(JSON.stringify(msg.payload, (_:any,v:any)=> typeof v==='bigint'?v.toString():v).slice(0,600));
});
ws.on('close', (c:number,r:Buffer)=>console.log('close',c,r.toString()));
ws.on('error', (e:Error)=>console.log('err',e.message));
