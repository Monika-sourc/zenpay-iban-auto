const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

function validateIBAN(iban) {
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (clean.length < 15 || clean.length > 34) return false;
  const rearr = clean.slice(4) + clean.slice(0, 4);
  const num = rearr.split('').map(c => isNaN(c) ? (c.charCodeAt(0)-55).toString() : c).join('');
  let rem = num.slice(0,9);
  let pos = 9;
  while(pos < num.length){
    rem = (parseInt(rem + num.substring(pos, pos+7)) % 97).toString();
    pos+=7;
  }
  return parseInt(rem) % 97 === 1;
}

app.get('/', (req,res) => {
  res.json({
    status: "ZenPay IBAN AUTO API - OK",
    route: "POST /api/iban",
    example: { iban: "DE89370400440532013000" }
  });
});

app.post('/api/iban', async (req, res) => {
  const { iban } = req.body;
  if (!iban) return res.status(400).json({ error: "Envoyez { iban: 'DE89...' }" });
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  if (!validateIBAN(cleanIBAN)) return res.json({ valid: false, iban: cleanIBAN });

  try {
    const response = await fetch(`https://openiban.com/validate/${cleanIBAN}?getBIC=true&validateBankCode=true`);
    const data = await response.json();
    if (data.valid && data.bankData) {
      return res.json({
        valid: true,
        iban: cleanIBAN,
        bankName: data.bankData.name,
        bic: data.bankData.bic,
        city: data.bankData.city,
        bankCode: data.bankData.bankCode,
        country: cleanIBAN.slice(0,2)
      });
    } else {
      return res.json({ valid: true, iban: cleanIBAN, bankName: "Banque non trouvée" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API AUTO IBAN lancée'));
