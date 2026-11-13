/* Public-source connections only. DNS is checked at socket creation, not in a separate preflight. */
const dns=require('node:dns'),net=require('node:net'),{Agent,fetch}=require('undici');
const blocked=new net.BlockList(),blocked6=new net.BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(address,prefix,'ipv4');
for(const [address,prefix] of [['::',128],['::1',128],['::ffff:0:0',96],['fc00::',7],['fe80::',10],['ff00::',8]])blocked6.addSubnet(address,prefix,'ipv6');
function publicAddress(address){const family=net.isIP(address);return !!family&&!(family===4?blocked:blocked6).check(address,family===4?'ipv4':'ipv6');}
function makeLookup(resolve=dns.lookup){return (hostname,options,callback)=>resolve(hostname,{all:true,verbatim:true},(error,addresses)=>{
 if(error)return callback(error);
 if(!addresses?.length||addresses.some(a=>!publicAddress(a.address)))return callback(Error('Public source resolved to a restricted network address'));
 if(options?.all)return callback(null,addresses);
 const selected=addresses.find(a=>!options?.family||a.family===options.family)||addresses[0];callback(null,selected.address,selected.family);
});}
function publicHost(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!net.isIP(u.hostname.replace(/^\[|\]$/g,''))&&u.hostname.includes('.')&&!/\.(?:local|localhost|internal|invalid|test)$/.test(u.hostname);}catch{return false;}}
const dispatcher=new Agent({connect:{lookup:makeLookup()},connections:2});
module.exports={dispatcher,fetch,makeLookup,publicAddress,publicHost};
