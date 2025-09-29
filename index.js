const express = require('express')
const cors = require('cors')
const nodemailer = require('nodemailer')
const { getCollection } = require('./db')
const { ObjectId } = require('mongodb')
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
      secure: true,
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

setupEmail();

// Pošalji email notifikaciju
// Pošalji email notifikaciju
async function sendReservationEmail(reservation) {
  const { discordNickname, description, date, time, course, tags } = reservation;

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
            <p><strong>🏷️ Tagovi:</strong> ${tags?.join(", ") || "Nema"}</p>
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
    console.log('✅ Email poslan na:', DEMONSTRATOR_EMAIL);
    console.log('📧 Message ID:', info.messageId);
  } catch (error) {
    console.error('🔥 Greška kod slanja emaila:', error.message);
  }
}


app.use(cors())
app.use(express.json());

// ==================== REZERVACIJE ====================

// POST rezervacija
app.post("/api/reservations", async (req, res) => {
  const { discordNickname, description, date, time, course, tags } = req.body;
  if (!discordNickname || !description || !date || !time || !course) {
    return res.status(400).json({ message: "Sva polja su obavezna." });
  }

  const dateTime = `${date} ${time}`;
  try {
    const col = await getCollection("demos");
    const exists = await col.findOne({ dateTime });
    if (exists) return res.status(409).json({ message: "Taj termin je već zauzet." });

    const reservation = { discordNickname, description, date, time, course, dateTime, tags: tags || [] };
    await col.insertOne(reservation);

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
    const col = await getCollection("demos");
    const reservations = await col.find().toArray();
    res.json(reservations);
  } catch (err) {
    console.error("🔥 Greška kod čitanja iz baze:", err);
    res.status(500).json({ message: "Greška kod čitanja iz baze.", error: err.message });
  }
});

// UPDATE rezervacija
app.put("/api/reservations/:id", async (req, res) => {
  const { id } = req.params;
  const { discordNickname, description, date, time, course } = req.body;

  if (!discordNickname || !description || !date || !time || !course) {
    return res.status(400).json({ message: "Sva polja su obavezna." });
  }

  const dateTime = `${date} ${time}`;

  try {
    const col = await getCollection("demos");
    
    // Provjeri da li postoji drugi termin s istim dateTime (ne uključujući trenutni)
    const exists = await col.findOne({ 
      dateTime, 
      _id: { $ne: new ObjectId(id) } 
    });
    
    if (exists) {
      return res.status(409).json({ message: "Taj termin je već zauzet." });
    }

    const result = await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { discordNickname, description, date, time, course, dateTime } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Rezervacija nije pronađena." });
    }

    res.status(200).json({ message: "Rezervacija uspješno ažurirana!" });
  } catch (err) {
    console.error("🔥 Greška kod ažuriranja:", err);
    res.status(500).json({ message: "Greška kod ažuriranja.", error: err.message });
  }
});

// DELETE rezervacija
app.delete("/api/reservations/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const col = await getCollection("demos");
    const result = await col.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Rezervacija nije pronađena." });
    }

    res.status(200).json({ message: "Rezervacija uspješno obrisana!" });
  } catch (err) {
    console.error("🔥 Greška kod brisanja:", err);
    res.status(500).json({ message: "Greška kod brisanja.", error: err.message });
  }
});

// ==================== PROBLEMI ====================

// POST problem
app.post("/api/problems", async (req, res) => {
  const { discordNickname, description, course, language, images, tags } = req.body;

  if (!discordNickname || !description || !course) {
    return res.status(400).json({ message: "Discord nick, opis i kolegij su obavezni." });
  }

  try {
    const col = await getCollection("problems");

    const problem = {
      discordNickname,
      description,
      course,
      language: language || '',
      images: images || [],
      tags: tags || [],
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

// UPDATE problem
app.put("/api/problems/:id", async (req, res) => {
  const { id } = req.params;
  const { discordNickname, description, course, language, images, tags } = req.body;

  if (!discordNickname || !description || !course) {
    return res.status(400).json({ message: "Discord nick, opis i kolegij su obavezni." });
  }

  try {
    const col = await getCollection("problems");

    const result = await col.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          discordNickname, 
          description, 
          course, 
          language: language || '',
          images: images || [],
          tags: tags || []
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Problem nije pronađen." });
    }

    res.status(200).json({ message: "Problem uspješno ažuriran!" });
  } catch (err) {
    console.error("🔥 Greška kod ažuriranja problema:", err);
    res.status(500).json({ message: "Greška kod ažuriranja.", error: err.message });
  }
});

// DELETE problem
app.delete("/api/problems/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const col = await getCollection("problems");
    const result = await col.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Problem nije pronađen." });
    }

    res.status(200).json({ message: "Problem uspješno obrisan!" });
  } catch (err) {
    console.error("🔥 Greška kod brisanja problema:", err);
    res.status(500).json({ message: "Greška kod brisanja.", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server dela na http://localhost:${PORT}`)
  console.log('📧 Email sistem automatski konfiguriran!')
});
