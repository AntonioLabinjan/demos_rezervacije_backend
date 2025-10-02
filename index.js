const express = require('express')
const cors = require('cors')
const nodemailer = require('nodemailer')
const { getCollection } = require('./db')
const { ObjectId } = require('mongodb')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "tajna"

// Middleware PRIJE svih ruta
app.use(cors())
app.use(express.json())

// Gmail SMTP configuration
const DEMONSTRATOR_EMAIL = 'alabinjan6@gmail.com'
let transporter;

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

// Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Nema tokena" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token nije ispravan" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, course }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token nije važeći" });
  }
}

// Email funkcija
async function sendReservationEmail(reservation) {
  const { email, description, date, time, course, tags } = reservation;

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
            <p><strong>👤 Student:</strong> ${email}</p>
            <p><strong>🏷️ Tagovi:</strong> ${tags?.join(", ") || "Nema"}</p>
            <p><strong>📝 Opis:</strong> ${description}</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email poslan:', info.messageId);
  } catch (error) {
    console.error('🔥 Greška kod slanja emaila:', error.message);
  }
}

// ==================== AUTH RUTE ====================

app.post("/api/signup", async (req, res) => {
  const { email, password, course } = req.body
  if (!email || !password || !course) {
    return res.status(400).json({ message: "Email, lozinka i kolegij su obavezni." })
  }

  try {
    const col = await getCollection("demos_users")
    const existingUser = await col.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ message: "Korisnik s tim emailom već postoji." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = { email, password: hashedPassword, course }

    await col.insertOne(newUser)
    res.status(201).json({ message: "Signup uspješan!" })
  } catch (err) {
    console.error("🔥 Greška kod signup-a:", err)
    res.status(500).json({ message: "Greška kod signup-a.", error: err.message })
  }
})

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ message: "Email i lozinka su obavezni." })
  }

  try {
    const col = await getCollection("demos_users")
    const user = await col.findOne({ email })
    if (!user) return res.status(401).json({ message: "Neispravan email ili lozinka." })

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) return res.status(401).json({ message: "Neispravan email ili lozinka." })

    const token = jwt.sign(
      { id: user._id, email: user.email, course: user.course },
      JWT_SECRET,
      { expiresIn: "2h" }
    )

    res.status(200).json({ 
      message: "Login uspješan!", 
      token,
      user: { email: user.email, course: user.course }
    })
  } catch (err) {
    console.error("🔥 Greška kod login-a:", err)
    res.status(500).json({ message: "Greška kod login-a.", error: err.message })
  }
})

// ==================== REZERVACIJE ====================

app.post("/api/reservations", async (req, res) => {
  const { email, description, date, time, course, tags } = req.body;
  if (!email || !description || !date || !time || !course) {
    return res.status(400).json({ message: "Sva polja su obavezna." });
  }

  const dateTime = `${date} ${time}`;
  try {
    const col = await getCollection("demos");
    const exists = await col.findOne({ dateTime });
    if (exists) return res.status(409).json({ message: "Taj termin je već zauzet." });

    const reservation = { 
      email, 
      description, 
      date, 
      time, 
      course, 
      dateTime, 
      tags: tags || [] 
    };
    await col.insertOne(reservation);

    await sendReservationEmail(reservation);

    res.status(200).json({ message: "Rezervacija uspješna! 📧 Email poslan." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Greška kod spremanja u bazu." });
  }
});

app.get("/api/reservations", authMiddleware, async (req, res) => {
  try {
    const col = await getCollection("demos");
    const reservations = await col.find({ course: req.user.course }).toArray();
    res.json(reservations);
  } catch (err) {
    console.error("🔥 Greška kod čitanja iz baze:", err);
    res.status(500).json({ message: "Greška kod čitanja iz baze.", error: err.message });
  }
});

app.put("/api/reservations/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { email, description, date, time, course, tags } = req.body;

  if (!email || !description || !date || !time || !course) {
    return res.status(400).json({ message: "Sva polja su obavezna." });
  }

  const dateTime = `${date} ${time}`;

  try {
    const col = await getCollection("demos");
    
    const exists = await col.findOne({ 
      dateTime, 
      _id: { $ne: new ObjectId(id) } 
    });
    
    if (exists) {
      return res.status(409).json({ message: "Taj termin je već zauzet." });
    }

    const result = await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { email, description, date, time, course, dateTime, tags: tags || [] } }
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

app.delete("/api/reservations/:id", authMiddleware, async (req, res) => {
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

app.post("/api/problems", async (req, res) => {
  const { email, description, course, language, images, tags } = req.body;

  if (!email || !description || !course) {
    return res.status(400).json({ message: "email, opis i kolegij su obavezni." });
  }

  try {
    const col = await getCollection("problems");

    const problem = {
      email,
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

app.put("/api/problems/:id", async (req, res) => {
  const { id } = req.params;
  const { email, description, course, language, images, tags } = req.body;

  if (!email|| !description || !course) {
    return res.status(400).json({ message: "email, opis i kolegij su obavezni." });
  }

  try {
    const col = await getCollection("problems");

    const result = await col.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          email, 
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
