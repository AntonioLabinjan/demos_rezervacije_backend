const express = require('express')
const cors = require('cors')
const { getCollection } = require('./db')
require('dotenv').config();

const app = express()
const PORT = process.env.PORT || 3000

//const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1386672205294993461/p6OG0K2SPUU5QcWgTd3mWlix6-ZDVkPguiQbu4WX9E7tGagUl9LMnFeyqSO6pVJCjQnN' 
app.use(cors())
app.use(express.json());

// POST rezervacija
app.post("/api/reservations", async (req, res) => {
  const { discordNickname, description, date, time, course } = req.body;
  if (!discordNickname || !description || !date || !time || !course) {
    return res.status(400).json({ message: "Sva polja su obavezna." });
  }

  const dateTime = `${date} ${time}`;
  try {
    const col = await getCollection("demos");
    const exists = await col.findOne({ dateTime });
    if (exists) return res.status(409).json({ message: "Taj termin je već zauzet." });

    const reservation = { discordNickname, description, date, time, course, dateTime };
    await col.insertOne(reservation);

    res.status(200).json({ message: "Rezervacija uspješna!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Greška kod spremanja u bazu." });
  }
});

// GET sve rezervacije
// GET sve rezervacije
app.get("/api/reservations", async (req, res) => {
  try {
    console.log("➡️ Dohvaćam kolekciju reservations...");
    const col = await getCollection("demos");
    console.log("✅ Kolekcija dohvaćena:", col.collectionName);

    const reservations = await col.find().toArray();
    console.log("📦 Rezervacije iz baze:", reservations.length);
    
    res.json(reservations);
  } catch (err) {
    console.error("🔥 Greška kod čitanja iz baze:", err);
    res.status(500).json({ message: "Greška kod čitanja iz baze.", error: err.message });
  }
});



app.listen(PORT, () => {
  console.log(`✅ Server dela na http://localhost:${PORT}`)
})
