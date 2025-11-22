import express from "express";
import axios from "axios";
import Stripe from "stripe";
import Mailjet from "node-mailjet";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Setup
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

// Canada free VIN API (test only)
const VIN_API = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

// -----------------------------
// 1️⃣ PREVIEW VIN (before payment)
// -----------------------------
app.get("/preview", async (req, res) => {
  try {
    const vin = req.query.vin;

    if (!vin) return res.json({ error: "VIN is required" });

    const response = await axios.get(
      `${VIN_API}/${vin}?format=json`
    );

    const data = response.data.Results[0];

    res.json({
      success: true,
      make: data.Make,
      model: data.Model,
      year: data.ModelYear
    });

  } catch (err) {
    res.json({ error: "Invalid VIN" });
  }
});

// -----------------------------
// 2️⃣ CREATE STRIPE CHECKOUT SESSION
// -----------------------------
app.post("/create-checkout", async (req, res) => {
  try {
    const { vin, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `Full VIN Report (${vin})`
            },
            unit_amount: 299, // $2.99
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.DOMAIN}/success.html?vin=${vin}&email=${email}`,
      cancel_url: `${process.env.DOMAIN}/cancel.html`
    });

    res.json({ url: session.url });

  } catch (err) {
    res.json({ error: "Stripe error" });
  }
});

// -----------------------------
// 3️⃣ SEND VIN REPORT EMAIL AFTER PAYMENT
// -----------------------------
app.post("/send-report", async (req, res) => {
  try {
    const { vin, email } = req.body;

    const response = await axios.get(
      `${VIN_API}/${vin}?format=json`
    );

    const data = response.data.Results[0];

    await mailjet
      .post("send", { version: "v3.1" })
      .request({
        Messages: [
          {
            From: {
              Email: process.env.SEND_FROM,
              Name: "VIN Check Canada"
            },
            To: [{ Email: email }],
            Subject: `Your VIN Report for ${vin}`,
            TextPart: `VIN Report\nMake: ${data.Make}\nModel: ${data.Model}\nYear: ${data.ModelYear}`,
            HTMLPart: `
              <h2>Your VIN Report</h2>
              <p><strong>VIN:</strong> ${vin}</p>
              <p><strong>Make:</strong> ${data.Make}</p>
              <p><strong>Model:</strong> ${data.Model}</p>
              <p><strong>Year:</strong> ${data.ModelYear}</p>
            `
          }
        ]
      });

    res.json({ success: true });

  } catch (err) {
    res.json({ error: "Email error" });
  }
});

// -----------------------------
// 4️⃣ START SERVER
// -----------------------------
app.listen(process.env.PORT || 10000, () => {
  console.log("Server running...");
});
