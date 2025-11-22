import express from "express";
import axios from "axios";
import Stripe from "stripe";
import Mailjet from "node-mailjet";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// App setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Mailjet
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

// =====================
// 1. PREVIEW VIN (Before Payment)
// =====================
app.get("/preview-vin", async (req, res) => {
  try {
    const vin = req.query.vin;

    const apiURL = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;

    const response = await axios.get(apiURL);

    const results = response.data.Results;
    const make = results.find(r => r.Variable === "Make")?.Value || "Unknown";
    const model = results.find(r => r.Variable === "Model")?.Value || "Unknown";

    res.json({
      success: true,
      vehicle: `${make} ${model}`
    });

  } catch (error) {
    res.json({ success: false, message: "VIN lookup failed" });
  }
});

// =====================
// 2. STRIPE PAYMENT
// =====================
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { vin, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 299, // $2.99
            product_data: {
              name: `VIN Lookup for ${vin}`
            }
          },
          quantity: 1
        }
      ],
      success_url: `${process.env.DOMAIN}/success.html?vin=${vin}&email=${email}`,
      cancel_url: `${process.env.DOMAIN}/cancel.html`
    });

    res.json({ url: session.url });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================
// 3. SEND EMAIL AFTER SUCCESS PAGE LOADS
// =====================
app.post("/send-email", async (req, res) => {
  try {
    const { vin, email } = req.body;

    const response = await axios.get(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);

    await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: { Email: process.env.SEND_FROM, Name: "VIN Report" },
          To: [{ Email: email }],
          Subject: `VIN Report for ${vin}`,
          HTMLPart: `<pre>${JSON.stringify(response.data, null, 2)}</pre>`
        }
      ]
    });

    res.json({ success: true });

  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// =====================
// SERVER START
// =====================
const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server running on port", port));
