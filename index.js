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

async function Zenox() {
  const sessionPath = "./lib/session/creds.json";

  if (!fs.existsSync(sessionPath)) {
    try {
      const url = `https://hastebin.com/raw/${config.SESSION_ID.split('~')[1]}`;
      const token = '50fa5f9415fcb28006c6a7eef079b74c08eff00a26daad06be0d34c4e4ca7057a8493d22981a28634ba825c22f2f9188e14d6a446ecfa0d5d0bc371497224f5f';
      let res = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      fs.writeFileSync("./lib/session/creds.json", res.data.content);
      console.log("Connection ID saved to Hastebin✅");
      console.log("Version : " + require("./package.json").version);
    } catch (err) {
      console.error("Failed to fetch Connection ID from Hastebin:", err.message);
      return;
    }
  }

  await delay(500);
  console.log("Syncing Database");
  await config.DATABASE.sync();

  const { state, saveCreds } = await useMultiFileAuthState("./lib/session", pino({ level: "silent" }));
  const conn = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.macOS("Desktop"),
    downloadHistory: false,
    syncFullHistory: false,
  });

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
