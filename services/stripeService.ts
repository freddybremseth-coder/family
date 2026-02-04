
/**
 * Stripe integrasjon for CASA CORE
 * Denne tjenesten kaller Vercel Serverless Functions for å opprette sessions
 */

export const createCheckoutSession = async (priceId: string, userEmail: string) => {
  try {
    // Dette punktet kaller din Vercel API-rute (/api/stripe/checkout)
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, email: userEmail }),
    });
    
    const session = await response.json();
    
    if (session.url) {
      window.location.href = session.url;
    }
  } catch (err) {
    console.error("Stripe Error:", err);
    alert("Kunne ikke koble til Stripe. Vennligst sjekk Vercel logs.");
  }
};

export const openCustomerPortal = async () => {
  // Lar kunden administrere kortet sitt og si opp abonnementet
  const response = await fetch('/api/stripe/portal', { method: 'POST' });
  const { url } = await response.json();
  if (url) window.location.href = url;
};
