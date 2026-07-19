require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  delay,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const path = require("path");
const express = require("express");
const pino = require("pino");
const axios = require("axios");
const got = require("got");
const cheerio = require("cheerio");
const readline = require("readline");
const { serialize } = require("./lib/serialize");
const { Message, Image, Sticker } = require("./lib/Base");
const events = require("./lib/event");
const config = require("./config");
const { PluginDB } = require("./lib/database/plugins");
const Greetings = require("./lib/Greetings");

require("events").EventEmitter.defaultMaxListeners = 500;

const store = makeInMemoryStore({ logger: pino({ level: "silent" }) });

fs.readdirSync("./lib/database/").forEach((plugin) => {
  if (path.extname(plugin).toLowerCase() === ".js") {
    require("./lib/database/" + plugin);
  }
});

const app = express();
const port = process.env.PORT || 3000;
const { token } = require("./config");

app.get("/", (req, res) => {
  res.send("Nezuko is alive");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function Zenox() {
  const sessionDir = "./lib/session";
  const sessionPath = `${sessionDir}/creds.json`;

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // ==========================================
  // BASE64 DECODER (Replaced Hastebin)
  // ==========================================
  if (!fs.existsSync(sessionPath) && config.SESSION_ID) {
    try {
      // Remove the "Nezuko~" prefix if it exists
      let b64 = config.SESSION_ID.startsWith("Nezuko~") 
        ? config.SESSION_ID.split('Nezuko~')[1] 
        : config.SESSION_ID;
        
      // Decode Base64 back into JSON text
      const decodedCreds = Buffer.from(b64, 'base64').toString('utf-8');
      
      // Save it directly as creds.json
      fs.writeFileSync(sessionPath, decodedCreds);
      console.log("Session ID successfully decoded and saved ✅");
    } catch (err) {
      console.error("Failed to decode Session ID. Make sure it is valid Base64:", err.message);
    }
  }

  console.log("Version : " + require("./package.json").version);
  await delay(500);
  console.log("Syncing Database");
  await config.DATABASE.sync();

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir, pino({ level: "silent" }));

  let useQR = false;
  let usePairing = false;
  let phoneNumber = "";

  if (!state.creds || !state.creds.registered) {
    console.log("\n-----------------------------------------");
    const choice = await question('Select Authentication Method:\nType "1" for QR Code\nType "2" for Pairing Code\nEnter choice: ');
    
    if (choice.trim() === '1') {
      useQR = true;
    } else if (choice.trim() === '2') {
      usePairing = true;
      phoneNumber = await question('Please enter your WhatsApp number (with country code, e.g., 91XXXXXXXXXX): ');
    } else {
      console.log("Invalid choice. Defaulting to QR Code.");
      useQR = true;
    }
    console.log("-----------------------------------------\n");
  }

  const conn = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: useQR,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    downloadHistory: false,
    syncFullHistory: false,
  });

  if (usePairing && !conn.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await conn.requestPairingCode(phoneNumber.trim());
        console.log(`\nYour Pairing Code is: ${code}\n`);
      } catch (error) {
        console.error("Error requesting pairing code:", error.message);
      }
    }, 3000);
  }

  store.bind(conn.ev);
  setInterval(() => {
    store.writeToFile("./lib/store_db.json");
    console.log("saved store");
  }, 30 * 60 * 1000);

  conn.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s;

    if (connection === "connecting") {
      console.log("nezuko\nVerifying Session...");
    }

    if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
      console.log(lastDisconnect.error.output);
      Zenox();
    }

    if (connection === "open") {
      console.log("Connected To Whatsapp ✅\nLoading Plugins ");

      try {
        let plugins = await PluginDB.findAll();
        for (const plugin of plugins) {
          const pluginPath = `./plugins/${plugin.dataValues.name}.js`;
          if (!fs.existsSync(pluginPath)) {
            try {
              const response = await got(plugin.dataValues.url);
              if (response.statusCode === 200) {
                fs.writeFileSync(pluginPath, response.body);
                require(pluginPath);
              }
            } catch (err) {
              console.error(`Error fetching plugin ${plugin.dataValues.name}:`, err.message);
            }
          }
        }
      } catch (e) {
        console.error("Error loading plugins from DB:", e.message);
      }

      fs.readdirSync("./plugins").forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() === ".js") {
          require("./plugins/" + plugin);
        }
      });

      console.log("Plugins Loaded ✅");

      const readMore = String.fromCharCode(8206).repeat(4001);
      const str = `*㋚ ɴᴇᴢᴜᴋᴏ ꜱᴛᴀʀᴛᴇᴅ* ${readMore}\n\n\n*⌑ ᴠᴇʀꜱɪᴏɴ*   : *${require("./package.json").version}* \n*⌑ ᴩʟᴜɢɪɴꜱ*  : *${events.commands.length}* \n*⌑ ᴡᴏʀᴋ ᴛʏᴩᴇ*  : *${config.WORK_TYPE}* \n*⌑ ᴩʀᴇꜰɪx*  : *${config.HANDLERS}*`;

      if (conn.user?.id) {
        conn.sendMessage(conn.user.id, { text: str });
      }

      try {
        conn.ev.on("creds.update", saveCreds);
        conn.ev.on("group-participants.update", async (data) => {
          Greetings(data, conn);
        });

        conn.ev.on("messages.upsert", async (m) => {
          if (m.type !== "notify") return;
          const ms = m.messages[0];
          const msg = await serialize(JSON.parse(JSON.stringify(ms)), conn);
          if (!msg.message) return;
          const text_msg = msg.body;

          if (text_msg && config.LOGS) {
            console.log(
              `At : ${msg.from.endsWith("@g.us") ? (await conn.groupMetadata(msg.from)).subject : msg.from}\nFrom : ${msg.sender}\nMessage:${text_msg}`
            );
          }

          for (const command of events.commands) {
            if (command.fromMe && !config.SUDO.split(",").includes(msg.sender.split("@")[0]) && !msg.isSelf)
              continue;

            let comman;
            if (text_msg) {
              comman = text_msg.trim().split(/ +/)[0];
              msg.prefix = new RegExp(config.HANDLERS).test(text_msg)
                ? text_msg.split("").shift()
                : ",";
            }

            if (command.pattern && command.pattern.test(comman)) {
              let match = text_msg.replace(new RegExp(comman, "i"), "").trim();
              const whats = new Message(conn, msg, ms);
              command.function(whats, match, msg, conn);
            } else if (text_msg && command.on === "text") {
              const whats = new Message(conn, msg, ms);
              command.function(whats, text_msg, msg, conn, m);
            } else if ((command.on === "image" || command.on === "photo") && msg.type === "imageMessage") {
              const whats = new Image(conn, msg, ms);
              command.function(whats, text_msg, msg, conn, m, ms);
            } else if (command.on === "sticker" && msg.type === "stickerMessage") {
              const whats = new Sticker(conn, msg, ms);
              command.function(whats, msg, conn, m, ms);
            }
          }
        });
      } catch (e) {
        console.error(e.stack + "\n\n\n\n\n" + JSON.stringify(msg));
      }
    }
  });

  process.on("uncaughtException", async (err) => {
    console.error("Uncaught Exception:", err);
    if (conn.user?.id) {
      await conn.sendMessage(conn.user.id, { text: err.message });
    }
  });
}

setTimeout(() => {
  Zenox();
}, 3000);

