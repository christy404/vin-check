import express from "express";
import axios from "axios";
import Stripe from "stripe";
import Mailjet from "node-mailjet";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Express setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Mailjet
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

// ===============================
// 1️⃣ PREVIEW VIN (Before payment)
// ===============================
app.get("/preview", async (req, res) => {
  try {
    const vin = req.query.vin;
    if (!vin) return res.status(400).json({ error: "VIN required" });

    const apiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`;
    const { data } = await axios.get(apiUrl);

    const result = data.Results[0];
    const vehicleName = `${result.Make} ${result.Model} ${result.ModelYear}`;

    res.json({ name: vehicleName });
