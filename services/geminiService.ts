
import { GoogleGenAI, Type } from "@google/genai";
import { Asset, FarmOperation, Bill, FamilyMember, FarmProfile, FarmTask, CryptoAsset } from "../types";

/**
 * Helper to get a fresh AI instance.
 * Prioriterer nøkkel lagret i localStorage (BYOK) over systemets miljøvariabler.
 */
const getAi = () => {
  const userKey = localStorage.getItem('user_gemini_api_key');
  const envKey = process.env.API_KEY;
  const finalKey = userKey || envKey;

  if (!finalKey || finalKey === 'undefined') {
    console.error("Gemini API_KEY mangler! Legg den inn i Innstillinger.");
  }
  return new GoogleGenAI({ apiKey: finalKey || '' });
};

/**
 * Sjekker om AI er konfigurert enten via system eller bruker.
 */
export const isAiAvailable = () => {
  const userKey = localStorage.getItem('user_gemini_api_key');
  const envKey = process.env.API_KEY;
  const finalKey = userKey || envKey;
  return !!finalKey && finalKey !== 'undefined' && finalKey !== '';
};

export const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeFamilyDocument = async (b64: string, mimeType = 'image/jpeg') => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { inlineData: { mimeType, data: b64 } },
      { text: `Analyser dette familiedokumentet. Hent ut forslag til metadata for FamilieHub.
      Svar på norsk. Ikke inkluder sensitive personnummer i notat. Hvis du ikke finner dato eller kategori, bruk tom verdi.` }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING, enum: ['Forsikring', 'Bolig', 'Bil', 'Helse', 'Barn', 'Kontrakt', 'Garanti', 'Annet'] },
          owner: { type: Type.STRING },
          expiryDate: { type: Type.STRING },
          note: { type: Type.STRING },
          summary: { type: Type.STRING }
        },
        required: ['title', 'category', 'owner', 'note']
      }
    }
  });
  return JSON.parse(response.text || '{"title":"","category":"Annet","owner":"Familien","note":""}');
};

/**
 * Fetches local holidays, fiestas, and events using Google Search.
 */
export const getLocalCalendarEvents = async (location: string, year: number) => {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Finn alle helligdager (bank holidays), nasjonale fridager, og lokale fiestas i ${location} for året ${year}.
      
      Spesifikke krav:
      - Inkluder nøyaktige datoer for lokale feiringer.
      - Returner resultatet som et JSON-objekt med en liste "events".`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['Holiday', 'Fiesta', 'Bank Holiday', 'Market'] },
                  isLocal: { type: Type.BOOLEAN }
                },
                required: ['date', 'title', 'description', 'type']
              }
            }
          },
          required: ['events']
        }
      }
    });

    return JSON.parse(response.text || '{"events": []}');
  } catch (err: any) {
    console.error("AI Calendar Error:", err);
    return { events: [] };
  }
};

export const getFarmStrategicAdvice = async (ops: FarmOperation[], profile: FarmProfile, tasks: FarmTask[]) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Du er en ekspert på landbruksøkonomi og strategisk ledelse for olivenproduksjon i Spania. 
    Analyser Dona Anna-gården basert på følgende data:
    Profil: ${JSON.stringify(profile)}
    Operasjoner: ${JSON.stringify(ops)}
    
    Fokusområder:
    1. Lønnsomhet: Hvordan maksimere marginene?
    2. Investeringer: Hva bør prioriteres (vanning, maskiner, solceller)?
    3. Kostnader: Hvor lekker det penger?
    4. Markedsføring: Hvordan skille seg ut i det norske/internasjonale markedet?
    
    Svar på norsk i en profesjonell og tydelig stil.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strategicSummary: { type: Type.STRING },
          profitabilityAnalysis: { type: Type.STRING },
          investmentSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          costSavingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          marketingIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
          criticalAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
          questionsForUser: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['strategicSummary', 'profitabilityAnalysis', 'investmentSuggestions', 'costSavingTips', 'marketingIdeas', 'criticalAlerts', 'questionsForUser']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getFinancialStatusInsight = async (stats: any, assets: Asset[]) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyser finansene: ${JSON.stringify(stats)}. Svar på norsk, kort og profesjonelt.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { message: { type: Type.STRING }, sentiment: { type: Type.STRING } },
        required: ['message', 'sentiment']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getSmartShoppingSuggestions = async (history: string[]) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Forslag basert på: ${history.join(', ')}. Svar på norsk.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ['name', 'reason']
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const analyzeFridge = async (b64: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: b64 } },
      { text: "Hva ser du i dette kjøleskapet? Lag en liste over ingredienser og foreslå 2 retter man kan lage." }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          identifiedItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          recipes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                fullIngredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, amount: { type: Type.STRING } } } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || '{"identifiedItems": [], "recipes": []}');
};

export const generateSmartMenu = async (inv: string[], cra: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Lag en ukemeny (7 dager). Lager: ${inv.join(', ')}. Preferanser: ${cra}. Svar på norsk.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING },
            dish: { type: Type.STRING },
            reason: { type: Type.STRING },
            recipe: {
              type: Type.OBJECT,
              properties: {
                fullIngredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, amount: { type: Type.STRING } } } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const analyzeReceipt = async (b64: string, mimeType = 'image/jpeg') => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { inlineData: { mimeType, data: b64 } },
      { text: `Analyser denne kvitteringen for FamilieHub.
      Returner butikk, dato, totalbeløp, valuta, betalingsmåte hvis synlig, linjer og riktig utgiftskategori.
      Kategori må være én av: Dagligvarer, Restaurant, Transport, Bolig, Bil, Barn, Helse, Klær, Reise, Business, Annet.
      Bruk totalbeløp inklusive MVA. Hvis valuta er ukjent, bruk NOK i Norge og EUR i Spania/EU.` }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendor: { type: Type.STRING },
          date: { type: Type.STRING },
          totalAmount: { type: Type.NUMBER },
          currency: { type: Type.STRING, enum: ['NOK', 'EUR'] },
          category: { type: Type.STRING, enum: ['Dagligvarer', 'Restaurant', 'Transport', 'Bolig', 'Bil', 'Barn', 'Helse', 'Klær', 'Reise', 'Business', 'Annet'] },
          paymentMethod: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          note: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING }
              }
            }
          }
        },
        required: ['vendor', 'date', 'totalAmount', 'currency', 'category']
      }
    }
  });
  return JSON.parse(response.text || '{"vendor":"Ukjent butikk","date":"","totalAmount":0,"currency":"NOK","category":"Annet"}');
};

export const getBillsSmartAdvice = async (bills: Bill[]) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyser disse regningene: ${JSON.stringify(bills)}. Svar på norsk.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            insight: { type: Type.STRING },
            action: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] }
          },
          required: ['insight', 'action', 'severity']
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const estimateAssetGrowth = async (type: string, loc: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Vekstestimat for ${type} i ${loc}. Svar på norsk.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { annualGrowthPct: { type: Type.NUMBER }, reasoning: { type: Type.STRING }, historicalContext: { type: Type.STRING } },
        required: ['annualGrowthPct', 'reasoning', 'historicalContext']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getFarmYieldForecast = async (profile: FarmProfile) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Lag en avlingsprognose for 2026 for Dona Anna basert på: ${JSON.stringify(profile)}. Bruk Google Search for Alicante klima-trender.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          forecastLiters: { type: Type.NUMBER },
          confidenceInterval: { type: Type.STRING },
          climaticContext: { type: Type.STRING },
          treeHealthAnalysis: { type: Type.STRING },
          projectedGrowthPct: { type: Type.NUMBER }
        },
        required: ['forecastLiters', 'confidenceInterval', 'climaticContext', 'treeHealthAnalysis', 'projectedGrowthPct']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const analyzeBankStatement = async (b64: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: b64 } },
      { text: "Analyser denne bankutskriften eller kontooversikten. Hent ut nåværende saldo og de siste transaksjonene." }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          balance: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          transactions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { date: { type: Type.STRING }, description: { type: Type.STRING }, amount: { type: Type.NUMBER }, type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE', 'TRANSFER'] } }, required: ['date', 'description', 'amount', 'type'] } }
        },
        required: ['balance', 'transactions']
      }
    }
  });
  return JSON.parse(response.text || '{"balance": 0, "transactions": []}');
};

export const generateZenEcoGuide = async () => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Du er en ekspert på det spanske boligmarkedet og en topp tekstforfatter for "Zen Eco Homes". Vi selger trygghet, kvalitet og livsstil til nordmenn. 
    Jeg trenger at du genererer følgende 4 deler:
    DEL 1: 5 forslag til fengende titler.
    DEL 2: Innholdsfortegnelse og struktur.
    DEL 3: Selve innholdet.
    DEL 4: Salgstekst til nettsiden.
    Svar på norsk.`,
    config: { thinkingConfig: { thinkingBudget: 4000 } }
  });
  return response.text;
};
