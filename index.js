const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()
const PORT = 3000

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1386672205294993461/p6OG0K2SPUU5QcWgTd3mWlix6-ZDVkPguiQbu4WX9E7tGagUl9LMnFeyqSO6pVJCjQnN' // ✅ ZAMIJENI SVOJIM

app.use(cors())
app.use(bodyParser.json())

const reservations = []

// POST → kreiranje rezervacije
app.post('/api/reservations', async (req, res) => {
  const { discordNickname, description, date, time } = req.body

  if (!discordNickname || !description || !date || !time) {
    return res.status(400).json({ message: 'Sva polja su obavezna.' })
  }

  const dateTime = `${date} ${time}`

  // Provjera da već ne postoji rezervacija za taj termin
  const exists = reservations.find(r => r.dateTime === dateTime)
  if (exists) {
    return res.status(409).json({ message: 'Taj termin je već zauzet.' })
  }

  // Spremi u memoriju
  const reservation = {
    discordNickname,
    description,
    date,
    time,
    dateTime
  }
  reservations.push(reservation)

  // Pošalji na Discord
  const message = {
    content: `🧠 **Novi termin**\n👤 **STUDENT:** ${discordNickname}\n📅 **DATUM:** ${date}\n🕒 **VRIJEME:** ${time}\n📝 **OPIS:** ${description}`,
  }

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
    res.status(200).json({ message: 'Rezervacija uspješna!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Greška kod slanja na Discord' })
  }
})

// GET → overview svih rezervacija
app.get('/api/reservations', (req, res) => {
  res.json(reservations)
})

app.listen(PORT, () => {
  console.log(`✅ Server dela na http://localhost:${PORT}`)
})
