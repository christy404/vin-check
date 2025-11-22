import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------- PREVIEW API ----------
app.get("/preview", (req, res) => {
    const vin = req.query.vin;

    // Dummy preview details
    const make = "Honda";
    const model = "Civic";

    res.json({ vin, make, model });
});

// ---------- CHECKOUT API ----------
app.post("/create-checkout", async (req, res) => {
    const { vin, email } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            customer_email: email,
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: { name: `VIN Report for ${vin}` },
                        unit_amount: 500, // $5
                    },
                    quantity: 1
                }
            ],
            mode: "payment",
            success_url: `${process.env.DOMAIN}/success.html?vin=${vin}&email=${email}`,
            cancel_url: `${process.env.DOMAIN}/cancel.html`
        });

        res.json({ url: session.url });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- SERVER START ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
