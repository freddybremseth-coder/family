
import { GoogleGenAI, Type } from "@google/genai";
import { Asset, FarmOperation, Bill, FamilyMember, FarmProfile, FarmTask, CryptoAsset } from "../types";

/**
 * Helper to get a fresh AI instance using the current environment key.
 */
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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

/**
 * AI Strategic Advice for Farm.
 * Oppgradert for å dekke lønnsomhet, investering og markedsføring.
 */
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
    5. Datamangler: Hvilken informasjon mangler du for å gi enda bedre råd?
    
    Svar på norsk i cyberpunk-stil.`,
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
          questionsForUser: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Informasjon AI-en trenger for bedre analyse" }
        },
        required: ['strategicSummary', 'profitabilityAnalysis', 'investmentSuggestions', 'costSavingTips', 'marketingIdeas', 'criticalAlerts', 'questionsForUser']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

/**
 * AI Yield Forecast.
 */
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

export const getFinancialStatusInsight = async (stats: any, assets: Asset[]) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyser finansene: ${JSON.stringify(stats)}. Svar på norsk cyberpunk-stil.`,
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
                fullIngredients: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT, 
                    properties: { name: { type: Type.STRING }, amount: { type: Type.STRING } } 
                  } 
                },
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

export const analyzeReceipt = async (b64: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: b64 } },
      { text: "Analyser denne kvitteringen." }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendor: { type: Type.STRING },
          date: { type: Type.STRING },
          totalAmount: { type: Type.NUMBER }
        },
        required: ['vendor', 'totalAmount']
      }
    }
  });
  return JSON.parse(response.text || '{"vendor": "Ukjent", "totalAmount": 0}');
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

export const analyzeBankStatement = async (b64: string) => ({});
export const getInvestmentStrategyAdvice = async (stats: any, assets: Asset[]) => ({});
export const analyzeOliveBusinessScenario = async (data: any) => ({});
export const getCryptoMarketIntelligence = async (portfolio: CryptoAsset[]) => ({ text: "", sources: [] });
