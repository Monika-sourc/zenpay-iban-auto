const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Mapping des banques Polonaises les plus courantes
const POLISH_BANKS = {
  "10100000": "Narodowy Bank Polski",
  "10200000": "PKO BP - PKO Bank Polski",
  "10300000": "Citi Handlowy - Bank Handlowy",
  "10500000": "ING Bank Slaski",
  "10600000": "BPH - Bank BPH",
  "10900000": "Santander Bank Polska",
  "10901014": "Santander Bank Polska",
  "11400000": "mBank - BRE Bank",
  "11600000": "Bank Millennium",
  "12400000": "Bank Pekao SA",
  "12800000": "HSBC France Oddzial w Polsce",
  "13200000": "Bank Pocztowy",
  "15000000": "Bank Citibank / Citi",
  "16000000": "BNP Paribas Bank Polska",
  "16800000": "Plus Bank",
  "17500000": "Raiffeisen / Nest Bank",
  "19500000": "Idea Bank",
  "20300000": "BNP Paribas",
  "29100006": "Aion Bank / UniCredit - Oddzial w Polsce"
};

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
  if(c==='PL') return iban.slice(4,12); // CORRIGE : 8 chiffres apres les 2 chiffres de controle
  if(c==='DE') return iban.slice(4,12);
  if(c==='FR') return iban.slice(4,9);
  if(c==='LT') return iban.slice(4,9);
  if(c==='ES') return iban.slice(4,8);
  if(c==='BE') return iban.slice(4,7);
  return iban.slice(4,8);
}

app.get('/', (req,res) => {
  res.json({ status: "ZenPay IBAN AUTO V3 - Corrige PL", route: "POST /api/iban" });
});

app.post('/api/iban', async (req, res) => {
  let { iban } = req.body;
  if (!iban) return res.status(400).json({ error: "Envoyez { iban: '...' }" });
  let cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  // Corrige si l'utilisateur oublie le P de PL
  if(cleanIBAN.startsWith('L') && !cleanIBAN.startsWith('LT') && cleanIBAN.length===27){
    cleanIBAN = 'P'+cleanIBAN;
  }
  const country = cleanIBAN.slice(0,2);
  const extractedCode = getBankCode(cleanIBAN);

  if (!validateIBAN(cleanIBAN)) {
    return res.json({ valid: false, iban: cleanIBAN, message: "IBAN invalide - verifiez que vous avez bien PL au debut" });
  }

  // 1. Essaye d'abord la base locale pour la Pologne
  if(country === 'PL' && POLISH_BANKS[extractedCode]){
    return res.json({
      valid: true,
      iban: cleanIBAN,
      country: country,
      bankCode: extractedCode,
      bankName: POLISH_BANKS[extractedCode],
      bic: "Voir relevé bancaire",
      source: "base locale PL corrigée"
    });
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
        source: "openiban.com"
      });
    }
  } catch(e){}

  // Fallback final
  const fallbackName = POLISH_BANKS[extractedCode] || `Banque ${country} - Code ${extractedCode}`;
  return res.json({
    valid: true,
    iban: cleanIBAN,
    country: country,
    bankCode: extractedCode,
    bankName: fallbackName,
    bic: "",
    source: "extraction locale corrigée"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API V3 PL corrigee'));
