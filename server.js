import express from "express";
import axios from "axios";
import Stripe from "stripe";
import { Resend } from "resend";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Resend
const resend = new Resend(process.env.RESEND_API_KEY);

/* ============================================
   1. VIN Preview — Free
============================================ */
app.post("/preview-vin", async (req, res) => {
  const { vin } = req.body;

  if (!vin) return res.json({ error: "VIN is required" });

  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`;
    const response = await axios.get(url);
    const data = response.data.Results[0];

    const car = `${data.ModelYear} ${data.Make} ${data.Model}`;
    res.json({ carName: car });
  } catch (error) {
    res.json({ error: "Error decoding VIN" });
  }
});

/* ============================================
   2. Stripe Checkout
============================================ */
app.post("/create-checkout-session", async (req, res) => {
  const { vin, email } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: { name: "VIN Check Report" },
            unit_amount: 499, 
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.DOMAIN}/success.html?vin=${vin}&email=${email}`,
      cancel_url: `${process.env.DOMAIN}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (error) {
    res.json({ error: "Stripe Error" });
  }
});

/* ============================================
   3. Send Email with Resend (After Payment)
============================================ */
app.post("/send-report", async (req, res) => {
  const { vin, email } = req.body;

  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`;
    const response = await axios.get(url);
    const data = response.data.Results[0];

    let report = "";
    for (const key in data) {
      report += `${key}: ${data[key]}\n`;
    }

    await resend.emails.send({
      from: process.env.SEND_FROM,
      to: email,
      subject: `Full VIN Report for ${vin}`,
      text: report,
    });

    res.json({ success: true });
  } catch (error) {
    res.json({ error: "Email sending failed" });
  }
});

app.listen(10000, () => {
  console.log("Server running on port 10000");
});
