const { command, isPrivate, tiny, isAdmin, parsedJid, isUrl } = require("../lib");
const Jimp = require("jimp");
const config = require("../config");

command(
  {
    pattern: "add ?(.*)",
    fromMe: true,
    desc: "Adds a person to the group",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    let num = match || message.reply_message.jid
    if (!num) return await message.reply("*_Need a number/reply/mention!_*");
    let user = num.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
    let admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    await message.client.groupParticipantsUpdate(message.jid, [user], "add")
    return await message.client.sendMessage(message.jid, { text: `*_@${user.split("@")[0]}, A Demon arrived!_*`, mentions: [user] })
  }
);


command(
  {
    pattern: "kick ?(.*)",
    fromMe: true,
    desc: "kick a person from the group",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    let num = match || message.reply_message.jid
    if (!num) return await message.reply("*_Ohh Baby,Need a number/reply/mention!_*");
    let user = num.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
    let admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    await message.client.groupParticipantsUpdate(message.jid, [user], "remove")
    return await message.client.sendMessage(message.jid, { text: `*_@${user.split("@")[0]}, Kicked from The Group!!! You  Are Now Useless!_*`, mentions: [user] })
  }
);



command(
  {
    pattern: "promote ?(.*)",
    fromMe: true,
    desc: "promote a member",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    let user = message.mention[0] || message.reply_message.jid
    if (!user) return await message.reply("*_Need a number/reply/mention!_*");
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    await message.client.groupParticipantsUpdate(message.jid, [user], "promote")
    return await message.client.sendMessage(message.jid, { text: `*_@${user.split("@")[0]}, You Are Now Hashira!!_*`, mentions: [user] })
  }
);


command(
  {
    pattern: "demote ?(.*)",
    fromMe: true,
    desc: "demote a member",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    let user = message.mention[0] || message.reply_message.jid
    if (!user) return await message.reply("*_Ohh,Need a number/reply/mention!_*");
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    await message.client.groupParticipantsUpdate(message.jid, [user], "demote")
    return await message.client.sendMessage(message.jid, { text: `*_@${user.split("@")[0]}, You Are Not Worthy!!_*`, mentions: [user] })
  }
);



command(
  {
    pattern: "mute",
    fromMe: true,
    desc: "nute group",
    type: "group",
  },
  async (message, match, m, client) => {
    if (!message.isGroup)
      return await message.reply("*_This command work only in group chats_*");
    if (!isAdmin(message.jid, message.user, message.client))
      return await message.reply("*_I'm not admin_*");
    await message.reply("*_Shhhhhh!!Muted!_*");
    return await client.groupSettingUpdate(message.jid, "announcement");
  }
);


command(
  {
    pattern: "unmute",
    fromMe: true,
    desc: "unmute group",
    type: "group",
  },
  async (message, match, m, client) => {
    if (!message.isGroup)
      return await message.reply("*_This command work only in groups_*");
    if (!isAdmin(message.jid, message.user, message.client))
      return await message.reply("*_I'm not admin_*");
    await message.reply("*_Unmuted!_*");
    return await client.groupSettingUpdate(message.jid, "not_announcement");
  }
);



command(
  {
    pattern: "gjid",
    fromMe: true,
    desc: "gets jid of all group members",
    type: "group",
  },
  async (message, match, m, client) => {
    if (!message.isGroup)
      return await message.reply("_This command work only in  group chats_");
    let { participants } = await client.groupMetadata(message.jid);
    let participant = participants.map((u) => u.id);
    let str = "╭──〔 *Group Jids* 〕\n";
    participant.forEach((result) => {
      str += `├ *${result}*\n`;
    });
    str += `╰──────────────`;
    message.reply(str);
  }
);




command(
  {
    pattern: "tagall?(.*)",
    fromMe: true,
    desc: "mention all users in group",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return;
    const { participants } = await message.client.groupMetadata(message.jid);
    let teks = "";
    for (let mem of participants) {
      teks += `☼ @${mem.id.split("@")[0]}\n`;
    }
    message.sendMessage(teks.trim(), {
      mentions: participants.map((a) => a.id),
    });
  }
);




command(
  {
    pattern: "tag",
    fromMe: true,
    desc: "mention all users in group",
    type: "group",
  },
  async (message, match) => {
    match = match || message.reply_message.text;
    if (!match) return message.reply("*_Enter or reply to a text to tag_*");
    if (!message.isGroup) return;
    const { participants } = await message.client.groupMetadata(message.jid);
    message.sendMessage(match, {
      mentions: participants.map((a) => a.id),
    });
  }
);



command(
  {
    on: "text",
    fromMe: false,
  },
  async (message, match) => {
    if (!message.isGroup) return;
    if (config.ANTILINK)
      if (isUrl(match)) {
        await message.reply("*_Link detected_*");
        let botadmin = await isAdmin(message.jid, message.user, message.client);
        let senderadmin = await isAdmin(
          message.jid,
          message.participant,
          message.client
        );
        if (botadmin) {
          if (!senderadmin) {
            await message.reply(
              `_Commencing Specified Action :${config.ANTILINK_ACTION}_`
            );
            return await message[config.ANTILINK_ACTION]([message.participant]);
          }
        } else {
          return await message.reply("*_I'm not admin_*");
        }
      }
  }
);


command(
  {
    pattern: "invite ?(.*)",
    fromMe: true,
    desc: "Provides the group's invitation link.",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_ohh,I'm not admin_*");
    const response = await message.client.groupInviteCode(message.jid)
    await message.reply(`_https://chat.whatsapp.com/${response}_`)
  }
);



command(
  {
    pattern: "revoke ?(.*)",
    fromMe: true,
    desc: "Revoke Group invite link.",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    await message.client.groupRevokeInvite(message.jid)
    await message.reply("*_Revoked!_*")
  }
);



command(
  {
    pattern: "join ?(.*)",
    fromMe: true,
    desc: "Join in the group",
    type: "group",
  },
  async (message, match) => {
    var rgx = /^(https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})$/
    if (!match || !rgx.test(match)) return await message.reply("*_Need group link_*")
    var res = await message.client.groupAcceptInvite(match.split("/")[3])
    if (!res) return await message.reply("*_Invalid Group Link!_*")
    if (res) return await message.reply("*_Joined!_*")
  }
);


command(
  {
    pattern: "left ?(.*)",
    fromMe: true,
    desc: "Left from the group",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    await message.client.groupLeave(message.jid)
  }
);

command(
  {
    pattern: "lock ?(.*)",
    fromMe: true,
    desc: "only allow admins to modify the group's settings.",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    await message.client.groupSettingUpdate(message.jid, "locked");
    return await message.sendMessage("*_Group Successfully Locked_*")
    
  }
);


command(
  {
    pattern: "unlock ?(.*)",
    fromMe: true,
    desc: "allow everyone to modify the group's settings.",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    await message.client.groupSettingUpdate(message.jid, "unlocked")
    return await message.sendMessage("*_Group Successfully Unlocked_*");
  }
);
  



command(
  {
    pattern: "gname ?(.*)",
    fromMe: true,
    desc: "Change group subject",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    match = match || message.reply_message.text
    if (!match) return await message.reply("*_Need Subject!_*\n*_Example: gname nezuko-MD Support!_.*")
    var { restrict } = message.client.groupMetadata(message.jid);;
    if (restrict && !(await isAdmin(message))) return await message.reply("*_I'm not admin_*");
    await message.client.groupUpdateSubject(message.jid, match)
    return await message.reply("*_Subject updated_*")
  }
);


command(
  {
    pattern: "gdesc ?(.*)",
    fromMe: true,
    desc: "Change group description",
    type: "group",
  },
  async (message, match) => {
    if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    match = match || message.reply_message.text
    if (!match) return await message.reply("*_Need Description!_*\n*_Example: gdesc Nezuko Wa BOT!_*")
    const participants =  await message.client.groupMetadata(message.jid)
    if (participants && !(await isAdmin(message.jid, message.user, message.client))) return await message.reply("_I'm not admin_");
    await message.client.groupUpdateDescription(message.jid, match)
    return await message.reply("*_Description updated_*")
  }
);


command(
  {
    pattern: "gpp$",
    fromMe: true,
    desc: "Change Group Icon",
    type: "group",
  },
  async (message, match,m) => {
  if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    if (!message.reply_message.image)
      return await message.reply("*_Reply to a photo_*");
    let media = await m.quoted.download();
    await message.client.updateProfilePicture(message.jid, media);
    return await message.reply("*_Successfully Group Icon Updated_*");
  }
);

async function updateProfilePicture(jid, imag, message) {
  const { query } = message.client;
  const { img } = await generateProfilePicture(imag);
  await query({
    tag: "iq",
    attrs: {
      to: jid,
      type: "set",
      xmlns: "w:profile:picture",
    },
    content: [
      {
        tag: "picture",
        attrs: { type: "image" },
        content: img,
      },
    ],
  });
}

async function generateProfilePicture(buffer) {
  const jimp = await Jimp.read(buffer);
  const min = jimp.getWidth();
  const max = jimp.getHeight();
  const cropped = jimp.crop(0, 0, min, max);
  return {
    img: await cropped.scaleToFit(324, 720).getBufferAsync(Jimp.MIME_JPEG),
    preview: await cropped.normalize().getBufferAsync(Jimp.MIME_JPEG),
  };
}




command(
  {
    pattern: "fullgpp$",
    fromMe: true,
    desc: "Change Group Icon",
    type: "group",
  },
  async (message, match,m) => {
  if (!message.isGroup) return await message.reply("*_This command only works in group chats_*")
    var admin = await isAdmin(message.jid, message.user, message.client);
    if (!admin) return await message.reply("*_I'm not admin_*");
    if (!message.reply_message.image)
      return await message.reply("*_Reply to a photo_*");
let media = await m.quoted.download();
    await updateProfilePicture(message.jid, media, message);
    return await message.reply("*_Profile Picture Updated_*");
    }
    );

async function updateProfilePicture(jid, imag, message) {
  const { query } = message.client;
  const { img } = await generateProfilePicture(imag);
  await query({
    tag: "iq",
    attrs: {
      to: jid,
      type: "set",
      xmlns: "w:profile:picture",
    },
    content: [
      {
        tag: "picture",
        attrs: { type: "image" },
        content: img,
      },
    ],
  });
}

async function generateProfilePicture(buffer) {
  const jimp = await Jimp.read(buffer);
  const min = jimp.getWidth();
  const max = jimp.getHeight();
  const cropped = jimp.crop(0, 0, min, max);
  return {
    img: await cropped.scaleToFit(324, 720).getBufferAsync(Jimp.MIME_JPEG),
    preview: await cropped.normalize().getBufferAsync(Jimp.MIME_JPEG),
  };
    }
