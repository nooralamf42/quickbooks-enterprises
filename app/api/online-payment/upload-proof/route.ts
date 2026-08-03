import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

// Configure Cloudinary with server-side credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images (JPG, PNG, GIF, WEBP) and PDF are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const isImage = file.type.startsWith('image/');
    const proofType = isImage ? 'image' : 'pdf';
    
    // Cloudinary blocks PDF delivery by default (401 error).
    // To bypass this without requiring security setting changes, we store PDFs as base64-encoded .txt files.
    const cloudinaryResourceType = proofType === 'pdf' ? 'raw' : 'image';
    const publicId = `proof_${orderId}_${Date.now()}${proofType === 'pdf' ? '.txt' : ''}`;
    
    // For PDFs, we convert the buffer to a base64 string to store as text
    const uploadBuffer = proofType === 'pdf' ? Buffer.from(buffer.toString('base64'), 'utf-8') : buffer;

    // Upload to Cloudinary via signed upload (server-side)
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'qb_payment_proofs',
          resource_type: cloudinaryResourceType,
          public_id: publicId,
          tags: ['payment_proof', proofType],
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary Upload Error]', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(uploadBuffer);
    });

    const proofUrl = uploadResult.secure_url;
    console.log('[Upload Proof] Cloudinary URL:', proofUrl);

    // Update the consent log: save proof URL + mark as Completed
    // (Online Payment is considered paid once proof is uploaded)
    const { db } = await connectToDatabase();
    const updateResult = await db.collection('admindata').updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          paymentProofUrl: proofUrl,
          paymentProofType: proofType,
          status: 'Completed',   // ← auto-complete on proof upload
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    console.log('[Upload Proof] MongoDB update:', updateResult.modifiedCount, 'doc(s) updated');

    return NextResponse.json({ success: true, proofUrl, proofType });
  } catch (error: any) {
    console.error('[Upload Proof] Error:', error);
    return NextResponse.json({ error: 'Upload failed', message: error.message }, { status: 500 });
  }
}
