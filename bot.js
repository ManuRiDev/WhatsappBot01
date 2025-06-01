const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // the QR
const mqtt = require('mqtt');

// config broker MQTT
const MQTT_BROKER = "your broker"; // your broker
const MQTT_TOPIC = "your topic"; // your topic

const mqttClient = mqtt.connect(MQTT_BROKER);
  
const destinationNumber = "your number@s.whatsapp.net"; // <-- your number
const destinationGroup = 'your number5@g.us'; // <-- your group jid
                      

mqttClient.on('connect', () => {
  console.log("✅ Conected to MQTT broker");
  // subscrite to the topic
  mqttClient.subscribe("your topic", (err) => {
    if (!err) {
      console.log("🟢 Suscrite to the topic ");
    }
  });
});

mqttClient.on('error', (err) => {
  console.error("❌ Error MQTT:", err);
});
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }), 
  });

  sock.ev.on('creds.update', saveCreds);
 
  //when a message arrives from the mqtt
    mqttClient.on("message", (topic, message) => {
    const dato = message.toString();
    const ndato = parseInt(message);
    console.log(`MQTT > ${topic}: ${dato}`); 

    try {     
      if(ndato < 0){ 
        sock.sendMessage(destinationGroup,{ text: `🌊 on forever`} ); 
      }else if(ndato > 0){        
        const minu = parseInt(ndato/60);
        const segun = parseInt(ndato%60);
        sock.sendMessage(destinationGroup,{ text: `🌊 on for ${minu}:minuts and ${segun}:seconds`} ); 
      }else{
        sock.sendMessage(destinationGroup,{ text: `🌊 off`} ); 
      }
    } catch (error) {     
      console.log(error); 
    }
  });

  // alowweb numbers
  const allowebNumbers = [
    "1234569xxx",  
    "0987654xxx" 
  ];
 

  // alloweb Names
  const allowebNames = [ 
    "you",    
    "other"  
  ];

  //Allowe Id  
  const allowebId = [ 
    "222333444xxxxxx"  
  ];
  
  // commands
  const commands = {
    "on": 1,
    "off": 0
  };

  // listen to the new messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    try {
      if (type !== 'notify') return;   

      const message = messages[0];         

      if(message.key.participant === undefined)return;
      if (!message.message) return; 

      const pushName = message.pushName;
      let jidReal = message.key.remoteJid;
      let realnumber = jidReal.split('@')[0];

      let partReal = message.key.participant;
      let participant = partReal.split('@')[0];

      if(allowebId.includes(realnumber)){
        if(!allowebNames.includes(pushName) && !allowebId.includes(participant)){            
          console.log("not autorized usser:", realnumber, pushName, message);
          return;
        }
      }else{
        return;
      }        

      const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || "").toLowerCase();       
      const partsSplit = text.split(','); 
      const sendJson = { action: parseInt(commands[partsSplit[0]])} 
      const action = commands[partsSplit[0]];       

      console.log("");  
      console.log("📩 message nuevo de:", pushName,";" , participant, "→", text," // ", action, " -- ",sendJson); 
      
      if (message.key.fromMe) return;

      switch (partsSplit[0]) {
        case 'on':   
          if (partsSplit[1] && parseInt(partsSplit[1])>0) { 
            sendJson.tiempo = parseInt(partsSplit[1]) * 60;   
            await sock.sendMessage(message.key.remoteJid, { text: 'turn on.... '+'for ' + partsSplit[1] + ' minutes' });
          }else{            
            sendJson.tiempo = -1; 
            await sock.sendMessage(message.key.remoteJid, { text: 'turn on.... forever'});
          }                 
          mqttClient.publish(MQTT_TOPIC, JSON.stringify(sendJson)); 
          console.log("new messages from:", pushName,";" , participant, "→", text," // ", action, " -- ",sendJson); 
          break;
        case 'off':
          await sock.sendMessage(message.key.remoteJid, { text: 'tunr off....' }); 
          sendJson.tiempo = 0;
          mqttClient.publish(MQTT_TOPIC, JSON.stringify(sendJson));   
          console.log("new messages from:", pushName,";" , participant, "→", text," // ", action, " -- ",sendJson); 
          break;  
        case 'status':          
            const sendStaJson = { status: ""}
            mqttClient.publish(MQTT_TOPIC, JSON.stringify(sendStaJson));
            console.log("new messages from:", pushName,";" , participant, "→", text," // ", action, " -- ",sendStaJson); 
         break;  
        default:        
          await sock.sendMessage(message.key.remoteJid, { text: 'not vaid command.-.-.-' });
          break;
      }  
 
    }
    catch (error) {
      console.log(type);
      console.log("---------")
      console.error("error in message:", error);
    }
  });

  // Show QR and manage the conecction
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("scan the Qr:");
      qrcode.generate(qr, { small: true }); 
    }

    if (connection === 'close') {
      const errorCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = errorCode !== DisconnectReason.loggedOut;
      console.log("disconnect. reconnect?", shouldReconnect);
      if (shouldReconnect) startBot();
    }

    if (connection === 'open') {
      console.log("Bot connected correctly to the red");
    }
  });
}

startBot();
