import fs from 'fs';
const envContent = fs.readFileSync('.env', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}
async function main() {
  const { setActiveEmailProvider, getActiveEmailProvider } = await import('./app/lib/emailProviderSettings');
  await setActiveEmailProvider('itwalk');
  console.log('Active provider now:', await getActiveEmailProvider());

  const { sendEmail } = await import('./app/lib/emailSender');
  const result = await sendEmail({
    from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
    to: 'nooralamcodes@gmail.com',
    subject: 'Dispatcher test via itWALK',
    html: '<p>Testing sendEmail() dispatcher routes correctly to itWALK.</p>',
  });
  console.log(JSON.stringify(result, null, 2));
}
main();
