async function run() {
  const url = 'https://staxjs.staxpayments.com/stax.js';
  const res = await fetch(url);
  const code = await res.text();
  
  // Find all window.* assignments
  const windowMatches = code.match(/window\.[a-zA-Z0-9_]+/g) || [];
  const uniqueWindow = [...new Set(windowMatches)];
  console.log('Window references:', uniqueWindow.filter(w => !['window.location', 'window.navigator', 'window.document', 'window.screen', 'window.innerWidth', 'window.innerHeight', 'window.outerWidth'].includes(w)));

  // Find all exported variables or Fattmerchant/Stax literal strings
  console.log('Contains Stax:', code.includes('Stax'));
  console.log('Contains Fattmerchant:', code.includes('Fattmerchant'));
  console.log('Contains StaxJs:', code.includes('StaxJs'));
}
run();
