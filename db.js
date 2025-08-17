const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function getCollection(collectionName) {
  if (!db) {
    try {
      await client.connect();
      db = client.db("demos"); // eksplicitno nazovi bazu
      console.log("✅ Spojeno na MongoDB Atlas!");
    } catch (err) {
      console.error("🔥 Greška kod spajanja na MongoDB:", err);
      throw err;
    }
  }
  return db.collection(collectionName);
}

module.exports = { getCollection };
