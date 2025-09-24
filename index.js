const express = require('express')
const cors = require('cors')
const nodemailer = require('nodemailer')
const { getCollection } = require('./db')
require('dotenv').config();

const app = express()
const PORT = process.env.PORT || 3000

// Gmail SMTP configuration
const DEMONSTRATOR_EMAIL = 'alabinjan6@gmail.com'
let transporter;

// Gmail SMTP setup
async function setupEmail() {
  try {
    transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // koristi SSL
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

    console.log('📧 Gmail SMTP konfiguriran');
  } catch (error) {
    console.error('Greška kod email setup-a:', error);
  }
}

// Pokreni email setup
setupEmail();

// Pošalji email notifikaciju
async function sendReservationEmail(reservation) {
  const { discordNickname, description, date, time, course } = reservation;
  
  if (!transporter) {
    console.log('⚠️ Email još nije spreman, preskačem...');
    return;
  }
  
  const mailOptions = {
    from: process.env.GMAIL_USER || 'your-email@gmail.com',
    to: DEMONSTRATOR_EMAIL,
    subject: `🔔 Nova rezervacija - ${course}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🔔 Nova rezervacija za demose</h2>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0;">📋 Detalji rezervacije:</h3>
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
            <p><strong>📅 Datum:</strong> ${date}</p>
            <p><strong>🕐 Vrijeme:</strong> ${time}</p>
            <p><strong>📚 Predmet:</strong> ${course}</p>
            <p><strong>👤 Student:</strong> ${discordNickname}</p>
            <p><strong>📝 Opis:</strong> ${description}</p>
          </div>
        </div>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #64748b; font-size: 14px;">
            ⚡ Ova poruka je automatski generirana kada student napravi novu rezervaciju.
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email poslat uspješno na:', DEMONSTRATOR_EMAIL);
    console.log('📧 Message ID:', info.messageId);
  } catch (error) {
    console.error('🔥 Greška kod slanja emaila:', error.message);
  }
}

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

    // 🚀 Pošalji email automatski!
    await sendReservationEmail(reservation);

    res.status(200).json({ message: "Rezervacija uspješna! 📧 Email poslan." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Greška kod spremanja u bazu." });
  }
});

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

// POST problem
app.post("/api/problems", async (req, res) => {
  const { discordNickname, description, course, language, images } = req.body;

  if (!discordNickname || !description || !course || !language) {
    return res.status(400).json({ message: "Sva polja osim slike su obavezna." });
  }

  try {
    const col = await getCollection("problems");

    const problem = {
      discordNickname,
      description,
      course,
      language,
      images: images || [],
      createdAt: new Date()
    };

    await col.insertOne(problem);

    res.status(200).json({ message: "Problem uspješno postavljen!" });
  } catch (err) {
    console.error("🔥 Greška kod spremanja problema:", err);
    res.status(500).json({ message: "Greška kod spremanja u bazu.", error: err.message });
  }
});

// GET svi problemi
app.get("/api/problems", async (req, res) => {
  try {
    const col = await getCollection("problems");
    const problems = await col.find().sort({ createdAt: -1 }).toArray(); 
    res.json(problems);
  } catch (err) {
    console.error("🔥 Greška kod čitanja problema:", err);
    res.status(500).json({ message: "Greška kod čitanja iz baze.", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server dela na http://localhost:${PORT}`)
  console.log('📧 Email sistem automatski konfiguriran!')
})
