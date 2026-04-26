// scripts/encode-admin-password.js
// Simple script to Base64 encode your admin password

function encodePassword() {
    const password = process.argv[2]; // Get password from command line argument
    
    if (!password) {
        console.error('Please provide a password as an argument');
        console.log('Usage: node scripts/encode-admin-password.js "your-admin-password"');
        process.exit(1);
    }

    try {
        // Simple Base64 encoding
        const encodedPassword = Buffer.from(password).toString('base64');
        
        console.log('Password Encoding Complete:');
        console.log('===========================');
        console.log(`Original Password: ${password}`);
        console.log(`Base64 Encoded: ${encodedPassword}`);
        console.log('');
        console.log('Add this to your .env.local file:');
        console.log(`NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD="${encodedPassword}"`);
        console.log('');
        console.log('Verification:');
        const decoded = Buffer.from(encodedPassword, 'base64').toString();
        console.log(`Decoded: ${decoded}`);
        console.log(`Match: ${decoded === password ? '✅ SUCCESS' : '❌ FAILED'}`);
        
    } catch (error) {
        console.error('Error encoding password:', error);
        process.exit(1);
    }
}

encodePassword();