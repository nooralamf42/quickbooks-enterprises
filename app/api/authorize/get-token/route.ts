import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, customerInfo, orderId } = body;

    const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
    const isProd = process.env.AUTHORIZE_NET_IS_PRODUCTION === 'true';

    if (!apiLoginId || !transactionKey) {
      return NextResponse.json({ error: 'Authorize.net credentials missing' }, { status: 500 });
    }

    const endpoint = isProd 
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    // The URL where Authorize.net will POST the iframe communicator
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    let communicatorUrl = `${baseUrl}/IFrameCommunicator.html`;
    
    if (isProd && communicatorUrl.startsWith('http://')) {
      communicatorUrl = communicatorUrl.replace('http://', 'https://');
    }

    const requestBody = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey
        },
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: amount.toFixed(2),
          order: {
            invoiceNumber: (orderId || `INV-${Date.now()}`).substring(0, 20),
            description: "QuickBooks Enterprise Subscription"
          },
          customer: {
            email: customerInfo?.email || ""
          },
          billTo: {
            firstName: customerInfo?.firstName || "",
            lastName: customerInfo?.lastName || "",
            company: customerInfo?.companyName || "",
            address: customerInfo?.address || "",
            city: customerInfo?.city || "",
            state: customerInfo?.state || "",
            zip: customerInfo?.zipCode || "",
            country: customerInfo?.country || "US"
          }
        },
        hostedPaymentSettings: {
          setting: [
            {
              settingName: "hostedPaymentReturnOptions",
              settingValue: JSON.stringify({
                showReceipt: false, // We handle success screen
              })
            },
            {
              settingName: "hostedPaymentButtonOptions",
              settingValue: JSON.stringify({
                text: "Pay Securely"
              })
            },
            {
              settingName: "hostedPaymentStyleOptions",
              settingValue: JSON.stringify({
                bgColor: "#ffffff"
              })
            },
            {
              settingName: "hostedPaymentPaymentOptions",
              settingValue: JSON.stringify({
                cardCodeRequired: true,
                showCreditCard: true,
                showBankAccount: false
              })
            },
            {
              settingName: "hostedPaymentSecurityOptions",
              settingValue: JSON.stringify({
                captcha: false
              })
            },
            {
              settingName: "hostedPaymentShippingAddressOptions",
              settingValue: JSON.stringify({
                show: false,
                required: false
              })
            },
            {
              settingName: "hostedPaymentBillingAddressOptions",
              settingValue: JSON.stringify({
                show: true,
                required: false
              })
            },
            {
              settingName: "hostedPaymentCustomerOptions",
              settingValue: JSON.stringify({
                showEmail: true,
                requiredEmail: true,
                addPaymentProfile: false
              })
            },
            {
              settingName: "hostedPaymentOrderOptions",
              settingValue: JSON.stringify({
                show: true,
                merchantName: "QuickBooks Enterprise Provider"
              })
            },
            {
              settingName: "hostedPaymentIFrameCommunicatorUrl",
              settingValue: JSON.stringify({
                url: communicatorUrl
              })
            }
          ]
        }
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.messages.resultCode !== 'Ok') {
      console.error('Authorize.net Token Error:', data.messages);
      return NextResponse.json({ error: 'Failed to generate payment token', details: data.messages }, { status: 400 });
    }

    return NextResponse.json({ token: data.token });

  } catch (error: any) {
    console.error('Auth.net get-token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
