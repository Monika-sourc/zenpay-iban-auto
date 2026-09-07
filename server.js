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

function getBankCode(iban){
  const c = iban.slice(0,2);
  if(c==='DE') return iban.slice(4,12);
  if(c==='FR') return iban.slice(4,9);
  if(c==='PL') return iban.slice(2,10);
  if(c==='LT') return iban.slice(4,9);
  if(c==='ES') return iban.slice(4,8);
  if(c==='BE') return iban.slice(4,7);
  return iban.slice(4,8);
}

app.get('/', (req,res) => {
  res.json({ status: "ZenPay IBAN AUTO V2 - OK", route: "POST /api/iban" });
});

app.post('/api/iban', async (req, res) => {
  const { iban } = req.body;
  if (!iban) return res.status(400).json({ error: "Envoyez { iban: '...' }" });
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  const country = cleanIBAN.slice(0,2);
  const extractedCode = getBankCode(cleanIBAN);

  if (!validateIBAN(cleanIBAN)) {
    return res.json({ valid: false, iban: cleanIBAN, message: "IBAN invalide" });
  }

  try {
    const response = await fetch(`https://openiban.com/validate/${cleanIBAN}?getBIC=true&validateBankCode=true`);
    const data = await response.json();

    if (data.valid && data.bankData && data.bankData.name) {
      return res.json({
        valid: true,
        iban: cleanIBAN,
        country: country,
        bankCode: data.bankData.bankCode || extractedCode,
        bankName: data.bankData.name,
        bic: data.bankData.bic || "",
        source: "openiban.com - auto"
      });
    } else {
      // IBAN valide mais banque pas dans la base gratuite -> on renvoie au moins le code
      return res.json({
        valid: true,
        iban: cleanIBAN,
        country: country,
        bankCode: extractedCode,
        bankName: `Banque ${country} - Code ${extractedCode}`,
        bic: "",
        note: "IBAN valide mais nom non trouvé dans la base gratuite. Code extrait automatiquement.",
        source: "extraction locale"
      });
    }
  } catch (err) {
    return res.json({
      valid: true,
      iban: cleanIBAN,
      country: country,
      bankCode: extractedCode,
      bankName: `Banque ${country} - Code ${extractedCode}`,
      bic: "",
      note: "Service externe indisponible, code extrait localement"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API V2 lancee'));
