const xrpl = require("xrpl");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
require("dotenv").config();

// XRPL Configuration
const issuerAddress = "rrnHBj9LEyY5PbXgFGx5WNRn5Vqt9KvyVH"; // Replace with your issuer address
const xrplEndpoint = "wss://s.altnet.rippletest.net:51233"; // Change to mainnet for production

// Discord Bot Configuration
const discordBotToken = process.env.DISCORD_BOT_TOKEN; // Add bot token in a .env file
const discordChannelID = process.env.DISCORD_CHANNEL_ID; // Add channel ID in a .env file

// Initialize Discord Bot
const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

discordClient.once("ready", () => {
  console.log(`Logged in as ${discordClient.user.tag}`);
});

// Function to send a message to Discord channel with an embed
async function sendToDiscord(nftName, nftImage, buyerAddress) {
  try {
    const channel = await discordClient.channels.fetch(discordChannelID);
    if (!channel) throw new Error("Channel not found");

    const embed = {
      color: 0x0099ff, // Embed color
      title: "🎉 New NFT Sale!",
      fields: [
        { name: "NFT Name", value: nftName, inline: false },
        { name: "Buyer Address", value: buyerAddress, inline: false },
      ],
      image: { url: nftImage }, // Directly display the image
      timestamp: new Date(),
      footer: { text: "ApeRunner Sales Bot" },
    };

    await channel.send({ embeds: [embed] });
    console.log("Message sent to Discord with image!");
  } catch (error) {
    console.error("Error sending message to Discord:", error.message);
  }
}

// Function to fetch NFT metadata
async function fetchMetadata(uri, tokenID) {
  const gateways = [
    "https://cloudflare-ipfs.com/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://dweb.link/ipfs/",
  ];

  for (const gateway of gateways) {
    try {
      const metadataURL = uri.startsWith("ipfs://")
        ? uri.replace("ipfs://", gateway)
        : `${gateway}${tokenID}`;
      console.log("Attempting to fetch metadata from:", metadataURL);

      const response = await axios.get(metadataURL);
      return response.data; // Return the metadata JSON
    } catch (error) {
      console.error(`Failed to fetch from gateway ${gateway}:`, error.message);
    }
  }

  console.error("All gateways failed.");
  return null; // Return null if all attempts fail
}

// Connect to XRPL and listen for transactions
async function listenForMints() {
  const xrplClient = new xrpl.Client(xrplEndpoint);
  try {
    await xrplClient.connect();
    console.log("Connected to XRPL!");

    await xrplClient.request({
      command: "subscribe",
      accounts: [issuerAddress],
    });

    console.log("Subscribed to account:", issuerAddress);

    xrplClient.on("transaction", async (tx) => {
      console.log("Transaction detected:", tx);

      try {
        const transaction = tx.tx_json;

        if (
          transaction &&
          transaction.TransactionType === "NFTokenMint" &&
          transaction.Account === issuerAddress
        ) {
          const buyerAddress = transaction.Account || "Unknown Buyer";

          const tokenURL = transaction.URI ? Buffer.from(transaction.URI, "hex").toString() : null;

          let nftName = "Unknown NFT";
          let nftImage = "https://example.com/default-image.png"; // Default image if none found

          if (tokenURL) {
            const metadata = await fetchMetadata(tokenURL || "", "");
            if (metadata) {
              nftName = metadata.name || nftName;
              nftImage = metadata.image
                ? metadata.image.startsWith("ipfs://")
                  ? metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")
                  : metadata.image
                : nftImage;
            }
          }

          // Send the message with the embed
          await sendToDiscord(nftName, nftImage, buyerAddress);
        }
      } catch (error) {
        console.error("Error processing transaction:", error.message);
      }
    });

    console.log("Listening for NFTokenMint transactions...");
  } catch (error) {
    console.error("Error connecting to XRPL or subscribing:", error.message);
  }
}

// Login to Discord and start XRPL listener
discordClient
  .login(discordBotToken)
  .then(() => {
    console.log("Discord bot logged in.");
    listenForMints();
  })
  .catch((error) => {
    console.error("Error logging in to Discord:", error.message);
  });
