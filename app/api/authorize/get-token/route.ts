import { NextRequest, NextResponse } from 'next/server';

/** Authorize.net's AnetApiSchema.xsd caps each billTo field at a fixed length — exceeding
 *  it doesn't get rejected gracefully, it throws E00003 and the whole payment token request
 *  fails. Truncating here is better than surfacing that as a customer-facing error for
 *  something as harmless as a long company name. */
const truncate = (value: string, maxLength: number) => value.slice(0, maxLength);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, customerInfo, orderId } = body;

    const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
    const isProd = process.env.NEXT_PUBLIC_AUTHORIZE_NET_IS_PRODUCTION === 'true';

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
            description: `QB_ORDER:${orderId}`
          },
          customer: {
            email: customerInfo?.email || ""
          },
          billTo: {
            firstName: truncate(customerInfo?.firstName || "", 50),
            lastName: truncate(customerInfo?.lastName || "", 50),
            company: truncate(customerInfo?.companyName || "", 50),
            address: truncate(customerInfo?.address || "", 60),
            city: truncate(customerInfo?.city || "", 40),
            state: truncate(customerInfo?.state || "", 40),
            zip: truncate(customerInfo?.zipCode || "", 20),
            country: truncate(customerInfo?.country || "US", 60)
          }
        },
        hostedPaymentSettings: {
          setting: [
            {
              settingName: "hostedPaymentReturnOptions",
              settingValue: JSON.stringify({
                showReceipt: false,
                url: `${baseUrl}/api/authorize/complete?oid=${orderId}`,
                urlText: "Continue",
                cancelUrl: `${baseUrl}`,
                cancelUrlText: "Cancel"
              })
            },
            {
              settingName: "hostedPaymentButtonOptions",
              settingValue: JSON.stringify({
                text: "Pay Now"
              })
            },
            {
              settingName: "hostedPaymentStyleOptions",
              settingValue: JSON.stringify({
                bgColor: "#2ca01c"
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
